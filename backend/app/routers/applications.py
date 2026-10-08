"""Student applications and T&P status management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_student, require_tp_cell
from app.models.application import Application
from app.models.company import Company
from app.models.student import StudentProfile
from app.models.user import User
from app.schemas.application import ApplicationResponse, ApplicationStatusUpdate

router = APIRouter(prefix="/api/applications", tags=["Applications"])


@router.post("/{company_id}", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def apply_to_company(company_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)) -> ApplicationResponse:
    student = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    company = db.query(Company).options(joinedload(Company.criteria)).filter(Company.id == company_id).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile was not found.")
    if company is None or company.status != "open":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This company is not accepting applications.")

    criteria = company.criteria
    minimum_cgpa = criteria.minimum_cgpa if criteria and criteria.minimum_cgpa is not None else company.minimum_cgpa
    if minimum_cgpa is not None and (student.cgpa is None or student.cgpa < minimum_cgpa):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your CGPA does not meet this company's eligibility criteria.")
    if criteria and criteria.eligible_branches and student.branch not in criteria.eligible_branches:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your branch is not eligible for this company.")
    if criteria and criteria.eligible_years and student.year not in criteria.eligible_years:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your current year is not eligible for this company.")

    application = Application(student_id=student.id, company_id=company.id, status="applied")
    db.add(application)
    try:
        db.commit()
        db.refresh(application)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already applied to this company.") from error
    return ApplicationResponse.model_validate(application)


@router.get("/my", response_model=list[ApplicationResponse])
def list_my_applications(user: User = Depends(require_student), db: Session = Depends(get_db)) -> list[ApplicationResponse]:
    student = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile was not found.")
    applications = db.query(Application).options(joinedload(Application.company).joinedload(Company.criteria)).filter(Application.student_id == student.id).order_by(Application.applied_at.desc()).all()
    return [ApplicationResponse.model_validate(application) for application in applications]


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ApplicationResponse:
    application = db.query(Application).options(joinedload(Application.student).joinedload(StudentProfile.user), joinedload(Application.company)).filter(Application.id == application_id).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application was not found.")
    if user.role == "student" and application.student.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own applications.")
    if user.role == "alumni":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Alumni cannot view private student applications.")
    return ApplicationResponse.model_validate(application)


@router.put("/{application_id}/status", response_model=ApplicationResponse)
def update_application_status(
    application_id: int,
    payload: ApplicationStatusUpdate,
    _user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    application = db.query(Application).options(joinedload(Application.company)).filter(Application.id == application_id).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application was not found.")
    application.status = payload.status
    db.commit()
    db.refresh(application)
    return ApplicationResponse.model_validate(application)
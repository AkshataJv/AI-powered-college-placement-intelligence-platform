"""Student-to-alumni mentorship request endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_alumni, require_student
from app.models.mentorship import MentorshipRequest
from app.models.user import User
from app.schemas.mentorship import MentorshipCreate, MentorshipResponse, MentorshipStatusUpdate

router = APIRouter(prefix="/api/mentorship", tags=["Mentorship"])


@router.post("", response_model=MentorshipResponse, status_code=status.HTTP_201_CREATED)
def create_mentorship_request(
    payload: MentorshipCreate,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> MentorshipResponse:
    alumni = db.query(User).filter(User.id == payload.alumni_id, User.role == "alumni").first()
    if alumni is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alumni account was not found.")
    request = MentorshipRequest(student_id=user.id, alumni_id=alumni.id, message=payload.message.strip())
    db.add(request)
    try:
        db.commit()
        db.refresh(request)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A mentorship request already exists for this alumni.") from error
    return MentorshipResponse.model_validate(request)


@router.get("/my-requests", response_model=list[MentorshipResponse])
def list_my_mentorship_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MentorshipResponse]:
    query = db.query(MentorshipRequest)
    if user.role == "student":
        query = query.filter(MentorshipRequest.student_id == user.id)
    elif user.role == "alumni":
        query = query.filter(MentorshipRequest.alumni_id == user.id)
    else:
        query = query.filter((MentorshipRequest.student_id == user.id) | (MentorshipRequest.alumni_id == user.id))
    return [MentorshipResponse.model_validate(item) for item in query.order_by(MentorshipRequest.created_at.desc()).all()]


@router.put("/{request_id}", response_model=MentorshipResponse)
def update_mentorship_request(
    request_id: int,
    payload: MentorshipStatusUpdate,
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
) -> MentorshipResponse:
    request = db.query(MentorshipRequest).filter(MentorshipRequest.id == request_id, MentorshipRequest.alumni_id == user.id).first()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentorship request was not found.")
    request.status = payload.status
    db.commit()
    db.refresh(request)
    return MentorshipResponse.model_validate(request)
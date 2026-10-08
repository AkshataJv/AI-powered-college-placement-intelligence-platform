"""T&P Cell dashboards, readiness, and placement analytics."""

import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_tp_cell
from app.models.announcement import Announcement
from app.models.application import Application
from app.models.certificate import Certificate
from app.models.company import Company
from app.models.student import StudentProfile
from app.models.user import User
from app.schemas.announcement import AnnouncementResponse
from app.schemas.application import ApplicationResponse
from app.schemas.certificate import CertificateResponse
from app.schemas.company import CompanyResponse

router = APIRouter(prefix="/api/tp", tags=["T&P Cell"])
tp_cell_router = APIRouter(prefix="/api/tp-cell", tags=["T&P Cell"])


@router.get("/students")
def list_students(_user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.query(StudentProfile).options(joinedload(StudentProfile.user)).order_by(StudentProfile.id.desc()).all()
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "name": row.user.name,
            "email": row.user.email,
            "phone": row.phone,
            "college": row.college,
            "course": row.course,
            "year": row.year,
            "branch": row.branch,
            "cgpa": row.cgpa,
            "location": row.location,
            "certificate_count": db.query(func.count(Certificate.id)).filter(Certificate.student_id == row.id).scalar() or 0,
        }
        for row in rows
    ]


@router.get("/students/{student_id}/certificates", response_model=list[CertificateResponse])
def get_student_certificates(
    student_id: int,
    _user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> list[CertificateResponse]:
    student = db.get(StudentProfile, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student was not found.")
    certs = db.query(Certificate).filter(Certificate.student_id == student_id).order_by(Certificate.issue_date.desc(), Certificate.uploaded_at.desc()).all()
    return [CertificateResponse.model_validate(c) for c in certs]


@router.get("/students/{student_id}/certificates/{certificate_id}/file")
def get_student_certificate_file(
    student_id: int,
    certificate_id: int,
    download: bool = Query(False),
    _user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> FileResponse:
    cert = db.query(Certificate).filter(Certificate.id == certificate_id, Certificate.student_id == student_id).first()
    if cert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate was not found.")
    if not cert.file_path or not Path(cert.file_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate file is not available on disk.")
    
    extension = Path(cert.file_name or cert.file_path).suffix.lower()
    media_type = mimetypes.guess_type(cert.file_name or cert.file_path)[0] or "application/octet-stream"
    disposition = "attachment" if download or extension != ".pdf" else "inline"
    safe_name = Path(cert.file_name or cert.file_path).name.replace('"', "")
    return FileResponse(
        path=cert.file_path,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{safe_name}"'},
    )


# Mirror endpoints under /api/tp-cell
@tp_cell_router.get("/students/{student_id}/certificates", response_model=list[CertificateResponse])
def get_student_certificates_alt(
    student_id: int,
    user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> list[CertificateResponse]:
    return get_student_certificates(student_id=student_id, _user=user, db=db)


@tp_cell_router.get("/students/{student_id}/certificates/{certificate_id}/file")
def get_student_certificate_file_alt(
    student_id: int,
    certificate_id: int,
    download: bool = Query(False),
    user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> FileResponse:
    return get_student_certificate_file(student_id=student_id, certificate_id=certificate_id, download=download, _user=user, db=db)


@router.get("/companies", response_model=list[CompanyResponse])
def list_tp_companies(_user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> list[CompanyResponse]:
    rows = db.query(Company).options(joinedload(Company.criteria)).order_by(Company.created_at.desc()).all()
    return [CompanyResponse.model_validate(row) for row in rows]


@router.get("/applications", response_model=list[ApplicationResponse])
def list_tp_applications(_user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> list[ApplicationResponse]:
    rows = db.query(Application).options(joinedload(Application.company).joinedload(Company.criteria)).order_by(Application.applied_at.desc()).all()
    return [ApplicationResponse.model_validate(row) for row in rows]


@router.get("/analytics")
def read_analytics(_user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> dict[str, int]:
    return {
        "total_students": db.query(func.count(StudentProfile.id)).scalar() or 0,
        "total_companies": db.query(func.count(Company.id)).scalar() or 0,
        "total_applications": db.query(func.count(Application.id)).scalar() or 0,
        "shortlisted_students": db.query(func.count(Application.id)).filter(Application.status == "shortlisted").scalar() or 0,
        "selected_students": db.query(func.count(Application.id)).filter(Application.status == "selected").scalar() or 0,
        "rejected_applications": db.query(func.count(Application.id)).filter(Application.status == "rejected").scalar() or 0,
    }


@router.get("/announcements", response_model=list[AnnouncementResponse])
def list_tp_announcements(_user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> list[AnnouncementResponse]:
    rows = db.query(Announcement).order_by(Announcement.created_at.desc()).all()
    return [AnnouncementResponse.model_validate(row) for row in rows]
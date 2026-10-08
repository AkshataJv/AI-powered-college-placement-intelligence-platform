"""T&P access to resumes attached to placement applications."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
import mimetypes
from pathlib import Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_tp_cell
from app.models.application import Application
from app.models.resume import Resume
from app.models.student import StudentProfile
from app.models.user import User

router = APIRouter(prefix="/api/tp/applications", tags=["Resumes"])


@router.get("/{application_id}/resume")
def view_applicant_resume(
    application_id: int,
    _user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> FileResponse:
    application = db.query(Application).filter(Application.id == application_id).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application was not found.")
    student = db.get(StudentProfile, application.student_id)
    resume = db.query(Resume).filter(Resume.student_id == student.id, Resume.is_current.is_(True)).first() if student else None
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This student has not uploaded a current resume.")
    extension = Path(resume.file_name).suffix.lower()
    media_type = mimetypes.guess_type(resume.file_name)[0] or "application/octet-stream"
    disposition = "inline" if extension == ".pdf" else "attachment"
    safe_name = Path(resume.file_name).name.replace('"', "")
    return FileResponse(
        path=resume.file_path,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{safe_name}"'},
    )
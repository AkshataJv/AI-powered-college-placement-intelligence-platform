"""Student-owned profile, skill, resume, and roadmap endpoints."""

from pathlib import Path
from uuid import uuid4
import mimetypes
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_student
from app.models.certificate import Certificate
from app.models.resume import Resume
from app.models.skill import Skill, StudentSkill
from app.models.student import StudentProfile
from app.models.user import User
from app.schemas.certificate import CertificateCreate, CertificateResponse, CertificateUpdate
from app.schemas.skill import StudentSkillCreate, StudentSkillResponse
from app.schemas.student import StudentMeResponse, StudentProfileResponse, StudentProfileUpdate
from app.schemas.resume import ResumeResponse

router = APIRouter(prefix="/api/students/me", tags=["Students"])
RESUME_DIRECTORY = Path(__file__).resolve().parents[2] / "uploads" / "resumes"
CERTIFICATE_DIRECTORY = Path(__file__).resolve().parents[2] / "uploads" / "certificates"
MAX_RESUME_BYTES = 10 * 1024 * 1024
MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024
ALLOWED_RESUME_TYPES = {".pdf", ".doc", ".docx"}
ALLOWED_CERTIFICATE_TYPES = {".pdf", ".png", ".jpg", ".jpeg"}


def get_profile(db: Session, user_id: int) -> StudentProfile:
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile was not found.")
    return profile


def validate_resume_file(file_name: str, content: bytes) -> str:
    extension = Path(file_name).suffix.lower()
    if extension not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume must be PDF, DOC, or DOCX.")
    signatures = {
        ".pdf": content.startswith(b"%PDF-"),
        ".doc": content.startswith(bytes.fromhex("D0CF11E0A1B11AE1")),
        ".docx": content.startswith(b"PK\x03\x04"),
    }
    if not signatures[extension]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The file content does not match its resume type.")
    return extension


@router.get("", response_model=StudentMeResponse)
def read_student_profile(user: User = Depends(require_student), db: Session = Depends(get_db)) -> StudentMeResponse:
    profile = get_profile(db, user.id)
    return StudentMeResponse(user=user, profile=StudentProfileResponse.model_validate(profile))


@router.put("", response_model=StudentMeResponse)
def update_student_profile(
    payload: StudentProfileUpdate,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudentMeResponse:
    profile = get_profile(db, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return StudentMeResponse(user=user, profile=StudentProfileResponse.model_validate(profile))


@router.get("/skills", response_model=list[StudentSkillResponse])
def list_student_skills(user: User = Depends(require_student), db: Session = Depends(get_db)) -> list[StudentSkillResponse]:
    profile = get_profile(db, user.id)
    links = db.query(StudentSkill).options(joinedload(StudentSkill.skill)).filter(StudentSkill.student_id == profile.id).all()
    return [StudentSkillResponse(skill=link.skill, proficiency=link.proficiency) for link in links]


@router.post("/skills", response_model=StudentSkillResponse, status_code=status.HTTP_201_CREATED)
def add_student_skill(
    payload: StudentSkillCreate,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> StudentSkillResponse:
    profile = get_profile(db, user.id)
    skill = db.get(Skill, payload.skill_id)
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill was not found.")
    link = db.get(StudentSkill, (profile.id, skill.id))
    if link is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This skill is already on the student profile.")
    link = StudentSkill(student_id=profile.id, skill_id=skill.id, proficiency=payload.proficiency)
    db.add(link)
    db.commit()
    db.refresh(link)
    return StudentSkillResponse(skill=skill, proficiency=link.proficiency)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student_skill(skill_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)) -> None:
    profile = get_profile(db, user.id)
    link = db.get(StudentSkill, (profile.id, skill_id))
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student skill was not found.")
    db.delete(link)
    db.commit()


@router.get("/resume", response_model=list[ResumeResponse])
def list_student_resumes(user: User = Depends(require_student), db: Session = Depends(get_db)) -> list[ResumeResponse]:
    profile = get_profile(db, user.id)
    resumes = db.query(Resume).filter(Resume.student_id == profile.id).order_by(Resume.uploaded_at.desc()).all()
    return [ResumeResponse.model_validate(resume) for resume in resumes]


@router.post("/resume", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_student_resume(
    file: UploadFile = File(...),
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> ResumeResponse:
    profile = get_profile(db, user.id)
    file_name = Path(file.filename or "resume").name
    extension = Path(file_name).suffix.lower()
    if extension not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume must be PDF, DOC, or DOCX.")

    content = await file.read(MAX_RESUME_BYTES + 1)
    if len(content) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Resume must be 10 MB or smaller.")
    validate_resume_file(file_name, content)

    RESUME_DIRECTORY.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{extension}"
    destination = RESUME_DIRECTORY / stored_name
    destination.write_bytes(content)

    db.query(Resume).filter(Resume.student_id == profile.id).update({Resume.is_current: False})
    resume = Resume(student_id=profile.id, file_name=file_name, file_path=str(destination), is_current=True)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return ResumeResponse.model_validate(resume)


@router.delete("/resume/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_resume(resume_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)) -> None:
    profile = get_profile(db, user.id)
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.student_id == profile.id).first()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume was not found.")
    file_path = Path(resume.file_path)
    db.delete(resume)
    db.commit()
    file_path.unlink(missing_ok=True)


@router.get("/certificates", response_model=list[CertificateResponse])
def list_student_certificates(user: User = Depends(require_student), db: Session = Depends(get_db)) -> list[CertificateResponse]:
    profile = get_profile(db, user.id)
    certs = db.query(Certificate).filter(Certificate.student_id == profile.id).order_by(Certificate.issue_date.desc(), Certificate.uploaded_at.desc()).all()
    return [CertificateResponse.model_validate(c) for c in certs]


@router.post("/certificates", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
async def create_student_certificate(
    name: str = Form(...),
    issuer: str = Form(...),
    issue_date: date = Form(...),
    credential_id: str | None = Form(None),
    credential_url: str | None = Form(None),
    description: str | None = Form(None),
    certificate: UploadFile | None = File(None),
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> CertificateResponse:
    profile = get_profile(db, user.id)
    file_name = None
    file_path = None
    file_size = 0

    if certificate and certificate.filename:
        file_name = Path(certificate.filename).name
        ext = Path(file_name).suffix.lower()
        if ext not in ALLOWED_CERTIFICATE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Certificate must be PDF, JPG, JPEG, or PNG.")
        content = await certificate.read(MAX_CERTIFICATE_BYTES + 1)
        if len(content) > MAX_CERTIFICATE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Certificate must be 5 MB or smaller.")
        CERTIFICATE_DIRECTORY.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid4().hex}{ext}"
        destination = CERTIFICATE_DIRECTORY / stored_name
        destination.write_bytes(content)
        file_path = str(destination)
        file_size = len(content)

    new_cert = Certificate(
        student_id=profile.id,
        name=name.strip(),
        issuer=issuer.strip(),
        issue_date=issue_date,
        credential_id=credential_id.strip() if credential_id else None,
        credential_url=credential_url.strip() if credential_url else None,
        description=description.strip() if description else None,
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
    )
    db.add(new_cert)
    db.commit()
    db.refresh(new_cert)
    return CertificateResponse.model_validate(new_cert)


@router.get("/certificates/{certificate_id}", response_model=CertificateResponse)
def get_student_certificate(
    certificate_id: int,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> CertificateResponse:
    profile = get_profile(db, user.id)
    cert = db.query(Certificate).filter(Certificate.id == certificate_id, Certificate.student_id == profile.id).first()
    if cert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate was not found.")
    return CertificateResponse.model_validate(cert)


@router.put("/certificates/{certificate_id}", response_model=CertificateResponse)
async def update_student_certificate(
    certificate_id: int,
    name: str = Form(...),
    issuer: str = Form(...),
    issue_date: date = Form(...),
    credential_id: str | None = Form(None),
    credential_url: str | None = Form(None),
    description: str | None = Form(None),
    certificate: UploadFile | None = File(None),
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> CertificateResponse:
    profile = get_profile(db, user.id)
    cert = db.query(Certificate).filter(Certificate.id == certificate_id, Certificate.student_id == profile.id).first()
    if cert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate was not found.")

    cert.name = name.strip()
    cert.issuer = issuer.strip()
    cert.issue_date = issue_date
    cert.credential_id = credential_id.strip() if credential_id else None
    cert.credential_url = credential_url.strip() if credential_url else None
    cert.description = description.strip() if description else None

    if certificate and certificate.filename:
        file_name = Path(certificate.filename).name
        ext = Path(file_name).suffix.lower()
        if ext not in ALLOWED_CERTIFICATE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Certificate must be PDF, JPG, JPEG, or PNG.")
        content = await certificate.read(MAX_CERTIFICATE_BYTES + 1)
        if len(content) > MAX_CERTIFICATE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Certificate must be 5 MB or smaller.")
        if cert.file_path:
            Path(cert.file_path).unlink(missing_ok=True)
        CERTIFICATE_DIRECTORY.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid4().hex}{ext}"
        destination = CERTIFICATE_DIRECTORY / stored_name
        destination.write_bytes(content)
        cert.file_name = file_name
        cert.file_path = str(destination)
        cert.file_size = len(content)

    db.commit()
    db.refresh(cert)
    return CertificateResponse.model_validate(cert)


@router.delete("/certificates/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_certificate(
    certificate_id: int,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    profile = get_profile(db, user.id)
    cert = db.query(Certificate).filter(Certificate.id == certificate_id, Certificate.student_id == profile.id).first()
    if cert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate was not found.")
    if cert.file_path:
        Path(cert.file_path).unlink(missing_ok=True)
    db.delete(cert)
    db.commit()


@router.get("/certificates/{certificate_id}/file")
def get_student_certificate_file_self(
    certificate_id: int,
    download: bool = Query(False),
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> FileResponse:
    profile = get_profile(db, user.id)
    cert = db.query(Certificate).filter(Certificate.id == certificate_id, Certificate.student_id == profile.id).first()
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



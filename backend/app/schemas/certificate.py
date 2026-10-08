"""Pydantic schemas for student certificates."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class CertificateBase(BaseModel):
    name: str
    issuer: str
    issue_date: date
    credential_id: str | None = None
    credential_url: str | None = None
    description: str | None = None


class CertificateCreate(CertificateBase):
    pass


class CertificateUpdate(BaseModel):
    name: str | None = None
    issuer: str | None = None
    issue_date: date | None = None
    credential_id: str | None = None
    credential_url: str | None = None
    description: str | None = None


class CertificateResponse(CertificateBase):
    id: int
    student_id: int
    file_name: str | None = None
    file_size: int = 0
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)

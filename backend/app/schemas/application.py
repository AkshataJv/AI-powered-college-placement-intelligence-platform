"""Placement application schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.company import CompanyResponse


ApplicationStatus = Literal["applied", "shortlisted", "rejected", "selected"]


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    company_id: int
    status: ApplicationStatus
    applied_at: datetime
    company: CompanyResponse | None = None
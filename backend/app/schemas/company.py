"""Company and placement eligibility schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CompanyStatus = Literal["upcoming", "open", "closed", "completed"]


class CompanyCriteriaCreate(BaseModel):
    criteria_text: str | None = None
    minimum_cgpa: float | None = Field(default=None, ge=0, le=10)
    required_skills: list[str] = Field(default_factory=list)
    eligible_branches: list[str] = Field(default_factory=list)
    eligible_years: list[int] = Field(default_factory=list)


class CompanyCriteriaResponse(CompanyCriteriaCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    description: str | None = None
    website: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=180)
    industry: str | None = Field(default=None, max_length=120)
    job_role: str = Field(min_length=1, max_length=180)
    package: float | None = Field(default=None, ge=0)
    minimum_cgpa: float | None = Field(default=None, ge=0, le=10)
    graduation_year: int | None = Field(default=None, ge=1950, le=2100)
    status: CompanyStatus = "upcoming"
    criteria: CompanyCriteriaCreate | None = None


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = None
    website: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=180)
    industry: str | None = Field(default=None, max_length=120)
    job_role: str | None = Field(default=None, min_length=1, max_length=180)
    package: float | None = Field(default=None, ge=0)
    minimum_cgpa: float | None = Field(default=None, ge=0, le=10)
    graduation_year: int | None = Field(default=None, ge=1950, le=2100)
    status: CompanyStatus | None = None
    criteria: CompanyCriteriaCreate | None = None


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    website: str | None
    location: str | None
    industry: str | None
    job_role: str
    package: float | None
    minimum_cgpa: float | None
    graduation_year: int | None
    status: CompanyStatus
    created_at: datetime
    updated_at: datetime
    criteria: CompanyCriteriaResponse | None
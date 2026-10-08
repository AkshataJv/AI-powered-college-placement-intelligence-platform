"""Alumni profile schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserResponse


class AlumniProfileUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=30)
    company: str | None = Field(default=None, max_length=180)
    job_title: str | None = Field(default=None, max_length=160)
    graduation_year: int | None = Field(default=None, ge=1950, le=2100)
    branch: str | None = Field(default=None, max_length=80)
    bio: str | None = None
    location: str | None = Field(default=None, max_length=180)
    linkedin_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)


class AlumniProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    phone: str | None
    company: str | None
    job_title: str | None
    graduation_year: int | None
    branch: str | None
    bio: str | None
    location: str | None
    linkedin_url: str | None
    github_url: str | None
    created_at: datetime
    updated_at: datetime


class AlumniResponse(BaseModel):
    user: UserResponse
    profile: AlumniProfileResponse
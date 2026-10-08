"""Student profile schemas."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserResponse


class StudentProfileUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=30)
    college: str | None = Field(default=None, max_length=180)
    course: str | None = Field(default=None, max_length=120)
    year: int | None = Field(default=None, ge=1, le=10)
    branch: str | None = Field(default=None, max_length=80)
    roll_number: str | None = Field(default=None, max_length=80)
    date_of_birth: date | None = None
    bio: str | None = None
    location: str | None = Field(default=None, max_length=180)
    github_url: str | None = Field(default=None, max_length=500)
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    cgpa: float | None = Field(default=None, ge=0, le=10)


class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    phone: str | None
    college: str | None
    course: str | None
    year: int | None
    branch: str | None
    roll_number: str | None
    date_of_birth: date | None
    bio: str | None
    location: str | None
    github_url: str | None
    linkedin_url: str | None
    portfolio_url: str | None
    cgpa: float | None
    created_at: datetime
    updated_at: datetime


class StudentMeResponse(BaseModel):
    user: UserResponse
    profile: StudentProfileResponse
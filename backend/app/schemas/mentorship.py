"""Mentorship request schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


MentorshipStatus = Literal["pending", "accepted", "rejected", "completed"]


class MentorshipCreate(BaseModel):
    alumni_id: int = Field(gt=0)
    message: str = Field(min_length=1, max_length=3000)


class MentorshipStatusUpdate(BaseModel):
    status: Literal["accepted", "rejected", "completed"]


class MentorshipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    alumni_id: int
    message: str
    status: MentorshipStatus
    created_at: datetime
    updated_at: datetime
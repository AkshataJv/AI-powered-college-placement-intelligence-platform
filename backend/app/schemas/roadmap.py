"""Student roadmap request and response schemas."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


RoadmapStatus = Literal["pending", "in_progress", "completed"]


class RoadmapCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str | None = None
    target_date: date | None = None
    status: RoadmapStatus = "pending"


class RoadmapUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = None
    target_date: date | None = None
    status: RoadmapStatus | None = None


class RoadmapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    title: str
    description: str | None
    target_date: date | None
    status: RoadmapStatus
    created_at: datetime
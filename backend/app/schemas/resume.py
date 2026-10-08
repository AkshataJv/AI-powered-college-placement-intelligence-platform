"""Resume metadata response schema."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    file_name: str
    uploaded_at: datetime
    is_current: bool
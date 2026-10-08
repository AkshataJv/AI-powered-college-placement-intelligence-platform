"""Skill catalog and student proficiency schemas."""

from pydantic import BaseModel, ConfigDict, Field


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=100)


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str


class StudentSkillCreate(BaseModel):
    skill_id: int = Field(gt=0)
    proficiency: float = Field(default=1, ge=0, le=5)


class StudentSkillResponse(BaseModel):
    skill: SkillResponse
    proficiency: float
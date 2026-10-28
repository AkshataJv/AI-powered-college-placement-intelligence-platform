import logging
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.roadmap_engine import generate_career_roadmap

logger = logging.getLogger("careerbridge-ai.roadmap")
router = APIRouter(tags=["Career Roadmap Generator"])


class RoadmapGenerateRequest(BaseModel):
    academic_year: str = "Third Year"
    target_role: str = "Software Engineer"
    target_company: str = "Target Recruiter"
    current_skills: list[str] = Field(default_factory=list)
    skill_gaps: list[str] = Field(default_factory=list)
    hours_per_week: int = 15


@router.post("/roadmap/generate")
def generate_roadmap_endpoint(req: RoadmapGenerateRequest) -> dict[str, Any]:
    """
    Generates a structured, phase-by-phase career preparation roadmap
    customized by academic year, target role, company, and study time.
    """
    logger.info("Generating career roadmap for year='%s', role='%s'", req.academic_year, req.target_role)
    return generate_career_roadmap(
        academic_year=req.academic_year,
        target_role=req.target_role,
        target_company=req.target_company,
        current_skills=req.current_skills,
        skill_gaps=req.skill_gaps,
        hours_per_week=req.hours_per_week,
    )

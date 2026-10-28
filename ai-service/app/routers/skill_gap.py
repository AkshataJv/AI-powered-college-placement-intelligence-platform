import logging
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.skill_gap_engine import perform_skill_gap_analysis

logger = logging.getLogger("careerbridge-ai.skill_gap")
router = APIRouter(tags=["Skill Gap Analysis"])


class SkillGapRequest(BaseModel):
    candidate_skills: list[str] = Field(default_factory=list)
    target_company: str = "Campus Recruiter"
    target_role: str = "Software Engineer"
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)


@router.post("/skill-gap/analyze")
def analyze_skill_gap(req: SkillGapRequest) -> dict[str, Any]:
    """
    Skill gap analysis comparing student skills against target company requirements.
    Categorizes skills into Matched, Needs Improvement, and Missing with priority and learning resources.
    """
    logger.info("Analyzing skill gap for role='%s' at company='%s'", req.target_role, req.target_company)
    return perform_skill_gap_analysis(
        candidate_skills=req.candidate_skills,
        target_company=req.target_company,
        target_role=req.target_role,
        required_skills=req.required_skills,
        preferred_skills=req.preferred_skills,
    )

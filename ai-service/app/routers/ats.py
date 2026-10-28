import logging
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.ats_engine import analyze_resume_ats

logger = logging.getLogger("careerbridge-ai.ats")
router = APIRouter(tags=["Resume ATS Analyzer"])


class ATSRequest(BaseModel):
    raw_text: str = ""
    parsed_skills: list[str] = Field(default_factory=list)
    education: list[dict[str, Any]] = Field(default_factory=list)
    experience: list[dict[str, Any]] = Field(default_factory=list)
    target_role: str = "Software Engineer"
    target_keywords: list[str] = Field(default_factory=list)


@router.post("/resume/ats-analyze")
def run_ats_analysis(req: ATSRequest) -> dict[str, Any]:
    """
    Analyzes resume text for ATS formatting, section completeness, action verbs,
    quantified outcomes, and keyword match against target role.
    """
    logger.info("Running ATS analysis for target_role='%s'", req.target_role)
    return analyze_resume_ats(
        raw_text=req.raw_text,
        parsed_skills=req.parsed_skills,
        education=req.education,
        experience=req.experience,
        target_role=req.target_role,
        target_keywords=req.target_keywords,
    )

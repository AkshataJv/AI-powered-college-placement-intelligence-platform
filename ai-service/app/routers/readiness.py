import logging
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.readiness_engine import calculate_placement_readiness

logger = logging.getLogger("careerbridge-ai.readiness")
router = APIRouter(tags=["Placement Readiness"])


class ReadinessRequest(BaseModel):
    profile: dict[str, Any] = Field(default_factory=dict)
    resume_analysis: dict[str, Any] | None = None
    coding_stats: dict[str, Any] | None = None
    mock_interview_stats: dict[str, Any] | None = None
    roadmap_stats: dict[str, Any] | None = None


@router.post("/readiness/calculate")
def calculate_readiness(req: ReadinessRequest) -> dict[str, Any]:
    """
    Stateless placement readiness scoring endpoint.
    Computes explainable, transparent 0-100 score, component breakdown,
    distinguishes preparation from probability, and suggests improvements.
    """
    logger.info("Calculating placement readiness for student profile")
    return calculate_placement_readiness(
        profile=req.profile,
        resume_analysis=req.resume_analysis,
        coding_stats=req.coding_stats,
        mock_interview_stats=req.mock_interview_stats,
        roadmap_stats=req.roadmap_stats,
    )

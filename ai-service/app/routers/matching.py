import time
import logging
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.skill_matcher import SkillMatcher
from app.services.embedding_model import embed_texts

logger = logging.getLogger("careerbridge-ai.matching_router")

router = APIRouter(tags=["Semantic Matching"])
matcher = SkillMatcher()


class MatchRequest(BaseModel):
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    candidate_skills: list[str] = Field(default_factory=list)


class BatchMatchCandidate(BaseModel):
    student_id: str
    skills: list[str] = Field(default_factory=list)


class BatchMatchRequest(BaseModel):
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    candidates: list[BatchMatchCandidate] = Field(default_factory=list)


@router.post("/match-score")
def match_score(request: MatchRequest) -> dict[str, Any]:
    """
    Compute semantic match score, category breakdown, and natural language
    explanation for a single candidate against target job requirements.
    Handles empty candidate_skills or required_skills gracefully.
    """
    full_match = matcher.compute_full_match(
        candidate_skills=request.candidate_skills,
        required_skills=request.required_skills,
        preferred_skills=request.preferred_skills,
        keywords=request.keywords,
    )
    explanation = matcher.generate_explanation(full_match)

    return {
        "semantic_score": full_match["semantic_score"],
        "required": full_match["required"],
        "preferred": full_match["preferred"],
        "keywords": full_match["keywords"],
        "explanation": explanation,
    }


@router.post("/match-score/batch")
def batch_match_score(request: BatchMatchRequest) -> dict[str, Any]:
    """
    Batch match scoring for multiple candidates.
    Optimizes by batch-encoding all unique target and candidate skills
    in a single embed_texts() call upfront, followed by vector cache lookups.
    Returns results sorted by semantic_score descending.
    """
    start_time = time.perf_counter()

    # Collect all unique skills across targets and candidates
    unique_skills_dict: dict[str, None] = {}
    for s in request.required_skills:
        unique_skills_dict[s] = None
    for s in request.preferred_skills:
        unique_skills_dict[s] = None
    for s in request.keywords:
        unique_skills_dict[s] = None
    for candidate in request.candidates:
        for s in candidate.skills:
            unique_skills_dict[s] = None

    unique_skills = list(unique_skills_dict.keys())

    # Upfront batch encoding for all unique skills
    embedding_cache = None
    if unique_skills:
        prepared_texts = [matcher._prepare_skill_text(s) for s in unique_skills]
        embeddings = embed_texts(prepared_texts)
        embedding_cache = {skill: embeddings[i] for i, skill in enumerate(unique_skills)}

    results = []
    for candidate in request.candidates:
        full_match = matcher.compute_full_match(
            candidate_skills=candidate.skills,
            required_skills=request.required_skills,
            preferred_skills=request.preferred_skills,
            keywords=request.keywords,
            embedding_cache=embedding_cache,
        )
        explanation = matcher.generate_explanation(full_match)

        results.append({
            "student_id": candidate.student_id,
            "semantic_score": full_match["semantic_score"],
            "required": full_match["required"],
            "preferred": full_match["preferred"],
            "keywords": full_match["keywords"],
            "explanation": explanation,
        })

    # Sort results by semantic_score descending
    results.sort(key=lambda r: r["semantic_score"], reverse=True)

    elapsed_time = time.perf_counter() - start_time
    logger.info(
        "Batch match completed for %d candidates across %d unique skills in %.4f seconds",
        len(request.candidates),
        len(unique_skills),
        elapsed_time,
    )

    return {"results": results}

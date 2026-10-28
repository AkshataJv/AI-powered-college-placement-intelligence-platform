import numpy as np
import pytest
from app.services.skill_matcher import SkillMatcher


@pytest.fixture(scope="module")
def matcher():
    return SkillMatcher()


def test_compute_similarity_matrix_shape(matcher):
    set_a = ["Python", "SQL", "Machine Learning"]
    set_b = ["ML", "Data Analysis"]

    matrix = matcher.compute_similarity_matrix(set_a, set_b)
    assert isinstance(matrix, np.ndarray)
    assert matrix.shape == (3, 2)

    # Empty sets handling
    empty_a = matcher.compute_similarity_matrix([], set_b)
    assert empty_a.shape == (0, 2)

    empty_b = matcher.compute_similarity_matrix(set_a, [])
    assert empty_b.shape == (3, 0)

    empty_both = matcher.compute_similarity_matrix([], [])
    assert empty_both.shape == (0, 0)


def test_match_skill_set_ml_to_machine_learning_and_python_not_marketing(matcher):
    # 1. Verify "ML" matches "Machine Learning" above threshold (0.55)
    res_ml = matcher.match_skill_set(
        candidate_skills=["ML", "React"],
        target_skills=["Machine Learning"],
        threshold=0.55,
    )
    assert len(res_ml["matched"]) == 1
    assert len(res_ml["missing"]) == 0
    assert res_ml["matched"][0]["target_skill"] == "Machine Learning"
    assert res_ml["matched"][0]["best_match"] == "ML"
    assert res_ml["matched"][0]["similarity"] >= 0.55
    assert res_ml["match_percentage"] == 100.0

    # 2. Verify "Python" does NOT match "Marketing" above threshold
    res_mismatch = matcher.match_skill_set(
        candidate_skills=["Python"],
        target_skills=["Marketing"],
        threshold=0.55,
    )
    assert len(res_mismatch["matched"]) == 0
    assert len(res_mismatch["missing"]) == 1
    assert res_mismatch["missing"][0]["target_skill"] == "Marketing"
    assert res_mismatch["missing"][0]["closest_candidate"] == "Python"
    assert res_mismatch["missing"][0]["similarity"] < 0.55
    assert res_mismatch["match_percentage"] == 0.0


def test_compute_full_match_weight_redistribution(matcher):
    # Case 1: preferred and keywords are empty -> 100% of weight to required
    res_only_req = matcher.compute_full_match(
        candidate_skills=["Python", "SQL"],
        required_skills=["Python", "SQL"],
        preferred_skills=[],
        keywords=[],
    )
    assert res_only_req["semantic_score"] == 100.0

    # Case 2: keywords empty -> required (0.60) and preferred (0.25) sum to 0.85
    # Required is 100% matched, Preferred is 0% matched
    # Expected: 100 * (0.60 / 0.85) = 70.59
    res_no_kw = matcher.compute_full_match(
        candidate_skills=["Python"],
        required_skills=["Python"],
        preferred_skills=["AWS"],
        keywords=[],
    )
    assert res_no_kw["semantic_score"] == 70.59

    # Case 3: All categories empty -> score is 0.0
    res_empty_all = matcher.compute_full_match(
        candidate_skills=["Python"],
        required_skills=[],
        preferred_skills=[],
        keywords=[],
    )
    assert res_empty_all["semantic_score"] == 0.0


def test_generate_explanation_produces_sensible_text(matcher):
    full_match = matcher.compute_full_match(
        candidate_skills=["Python", "ML", "React"],
        required_skills=["Python", "Machine Learning", "Communication"],
        preferred_skills=["AWS"],
        keywords=["Docker"],
    )

    explanation = matcher.generate_explanation(full_match)
    assert isinstance(explanation, str)
    assert len(explanation.strip()) > 20
    assert "required skills found" in explanation
    assert "Missing:" in explanation
    assert "Machine Learning" in explanation or "Python" in explanation

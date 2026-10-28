import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_match_score_endpoint_success():
    payload = {
        "candidate_skills": ["Python", "ML", "React", "Communication"],
        "required_skills": ["Python", "Machine Learning", "SQL"],
        "preferred_skills": ["AWS"],
        "keywords": [],
    }
    response = client.post("/match-score", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "semantic_score" in data
    assert "required" in data
    assert "preferred" in data
    assert "keywords" in data
    assert "explanation" in data

    # Confirm "Machine Learning" was matched via "ML" in the response
    req_matched = data["required"]["matched"]
    ml_match = next((item for item in req_matched if item["target_skill"] == "Machine Learning"), None)
    assert ml_match is not None, "Target skill 'Machine Learning' should be matched"
    assert ml_match["best_match"] == "ML"
    assert ml_match["similarity"] >= 0.55

    # Check SQL is in missing
    req_missing = data["required"]["missing"]
    sql_missing = next((item for item in req_missing if item["target_skill"] == "SQL"), None)
    assert sql_missing is not None, "Target skill 'SQL' should be missing"


def test_match_score_empty_skills_graceful_handling():
    # Empty candidate skills
    resp1 = client.post("/match-score", json={
        "candidate_skills": [],
        "required_skills": ["Python", "SQL"],
        "preferred_skills": [],
        "keywords": [],
    })
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["semantic_score"] == 0.0
    assert len(data1["required"]["missing"]) == 2

    # Empty required skills
    resp2 = client.post("/match-score", json={
        "candidate_skills": ["Python", "SQL"],
        "required_skills": [],
        "preferred_skills": [],
        "keywords": [],
    })
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["semantic_score"] == 0.0


def test_batch_match_score_endpoint_success():
    payload = {
        "required_skills": ["Python", "Machine Learning", "SQL"],
        "preferred_skills": ["AWS", "Docker"],
        "keywords": ["Git"],
        "candidates": [
            {
                "student_id": "stud-low",
                "skills": ["HTML", "CSS"],
            },
            {
                "student_id": "stud-top",
                "skills": ["Python", "ML", "SQL", "AWS", "Docker", "Git"],
            },
            {
                "student_id": "stud-mid",
                "skills": ["Python", "React", "Git"],
            },
        ],
    }

    response = client.post("/match-score/batch", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "results" in data
    results = data["results"]
    assert len(results) == 3

    # Confirm all 3 student_ids present
    student_ids = [r["student_id"] for r in results]
    assert "stud-top" in student_ids
    assert "stud-mid" in student_ids
    assert "stud-low" in student_ids

    # Confirm sorted by semantic_score descending
    scores = [r["semantic_score"] for r in results]
    assert scores == sorted(scores, reverse=True)
    assert results[0]["student_id"] == "stud-top"
    assert results[-1]["student_id"] == "stud-low"
    assert results[0]["semantic_score"] > results[-1]["semantic_score"]

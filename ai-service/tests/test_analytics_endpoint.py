from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_placement_insights_endpoint_empty():
    payload = {
        "academic_year": "2024-25",
        "branch": "CSE",
        "total_placed": 0,
        "total_offers": 0,
        "total_eligible": 50,
        "placement_percentage": 0.0,
    }
    response = client.post("/analytics/placement-insights", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "No placement records are currently available" in data["executive_summary"]
    assert len(data["observations"]) > 0


def test_placement_insights_endpoint_with_data():
    payload = {
        "academic_year": "2024-25",
        "branch": "All",
        "company": "All",
        "total_placed": 142,
        "total_offers": 168,
        "total_eligible": 160,
        "placement_percentage": 88.75,
        "highest_package": 44.0,
        "average_package": 11.2,
        "median_package": 10.0,
        "yoy_growth": 14.5,
        "yearly_trends": [
            {"year": "2023-24", "placed": 124, "offers": 140, "eligible": 150, "placement_percentage": 82.67},
            {"year": "2024-25", "placed": 142, "offers": 168, "eligible": 160, "placement_percentage": 88.75},
        ],
        "branch_stats": [
            {"branch": "CSE", "placed": 58, "eligible": 62, "placement_percentage": 93.5, "avg_package": 12.5, "highest_package": 44.0},
            {"branch": "AIDS", "placed": 42, "eligible": 46, "placement_percentage": 91.3, "avg_package": 12.0, "highest_package": 42.0},
            {"branch": "IT", "placed": 42, "eligible": 52, "placement_percentage": 80.7, "avg_package": 10.0, "highest_package": 36.0},
        ],
        "company_stats": [
            {"company": "Google", "count": 6, "avg_package": 38.0},
            {"company": "Persistent Systems", "count": 32, "avg_package": 11.5},
            {"company": "TCS Digital", "count": 48, "avg_package": 7.5},
        ],
        "top_skills": [
            {"skill": "Python", "count": 112},
            {"skill": "SQL", "count": 98},
            {"skill": "Data Structures", "count": 92},
            {"skill": "AWS", "count": 64},
        ],
    }
    response = client.post("/analytics/placement-insights", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "142 unique students" in data["executive_summary"]
    assert "+14.5% increase" in data["executive_summary"]
    assert len(data["observations"]) >= 3
    assert len(data["recommendations"]) >= 3
    assert data["data_highlights"]["top_branch"] == "CSE"
    assert data["data_highlights"]["top_recruiter"] == "TCS Digital"

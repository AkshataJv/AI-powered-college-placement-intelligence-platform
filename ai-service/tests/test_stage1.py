from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_readiness_calculation():
    payload = {
        "profile": {
            "name": "Jane Doe",
            "skills": ["Python", "Java", "React", "SQL", "Docker"],
            "cgpa": 8.8,
            "backlogs": 0,
            "certifications": 2,
        },
        "resume_analysis": {
            "word_count": 450,
            "skills": ["Python", "React", "SQL"],
            "education": [{"degree": "B.Tech"}],
            "experience": [{"title": "Intern"}],
        },
        "coding_stats": {
            "problems_solved": 35,
            "topics_covered": 8,
        },
        "roadmap_stats": {
            "progress_percent": 60.0,
        },
        "mock_interview_stats": {
            "interviews_completed": 2,
            "avg_score": 82.0,
        },
    }
    response = client.post("/readiness/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "overall_score" in data
    assert 0 <= data["overall_score"] <= 100
    assert len(data["factors"]) == 5
    assert "distinction_note" in data
    assert "estimated_placement_probability" in data
    assert data["overall_score"] >= 70.0


def test_skill_gap_analysis():
    payload = {
        "candidate_skills": ["Python", "SQL", "Git"],
        "target_company": "Amazon",
        "target_role": "Backend Engineer",
        "required_skills": ["Java", "Data Structures", "System Design"],
        "preferred_skills": ["AWS", "Docker", "Python"],
    }
    response = client.post("/skill-gap/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "matched_skills" in data
    assert "missing_skills" in data
    assert "improvement_skills" in data
    assert "actionable_next_steps" in data
    assert len(data["actionable_next_steps"]) > 0


def test_ats_analysis():
    sample_text = """
    Jane Doe - Software Engineer
    Email: jane@example.com | Phone: +91 9876543210 | GitHub: github.com/janedoe

    EDUCATION
    B.Tech in Computer Science, State University, 2025. CGPA: 8.9

    TECHNICAL SKILLS
    Languages: Python, Java, JavaScript, SQL
    Frameworks & Tools: React, Node.js, Docker, Git

    PROJECTS
    • Engineered a real-time messaging pipeline using WebSockets and Redis, reducing latency by 45%.
    • Developed a microservices-based e-commerce backend handling 10k requests per second.
    • Architected full-stack authentication using JWT and bcrypt with 100% test coverage.

    EXPERIENCE
    Software Engineering Intern - ABC Tech (Summer 2024)
    • Automated daily data ingestion scripts in Python, saving 15 engineering hours weekly.
    • Optimized SQL database queries to improve page load speed by 30%.
    """
    payload = {
        "raw_text": sample_text,
        "parsed_skills": ["Python", "Java", "SQL", "React", "Docker"],
        "target_role": "Software Engineer",
        "target_keywords": ["Python", "Docker", "SQL", "System Design"],
    }
    response = client.post("/resume/ats-analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "ats_score" in data
    assert 0 <= data["ats_score"] <= 100
    assert "disclaimer" in data
    assert len(data["detected_action_verbs"]) >= 3
    assert data["score_breakdown"]["section_completeness"]["score"] > 20


def test_roadmap_generation():
    payload = {
        "academic_year": "Third Year",
        "target_role": "Software Engineer",
        "target_company": "Microsoft",
        "current_skills": ["Python", "C++"],
        "skill_gaps": ["Dynamic Programming", "System Design"],
        "hours_per_week": 15,
    }
    response = client.post("/roadmap/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "stages" in data
    assert len(data["stages"]) == 4
    assert data["total_weeks"] == 16
    assert data["total_tasks_count"] > 0
    # verify task structure
    first_task = data["stages"][0]["weeks"][0]["tasks"][0]
    assert "title" in first_task
    assert "category" in first_task
    assert "resource_url" in first_task

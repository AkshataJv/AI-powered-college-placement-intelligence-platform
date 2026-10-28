import io
import pytest
from fastapi.testclient import TestClient
from fpdf import FPDF
from app.main import app

client = TestClient(app)


def generate_sample_pdf_bytes() -> bytes:
    """Generate a clean, small 1-page PDF in memory using fpdf2."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=12)
    pdf.cell(text="Candidate Profile")
    pdf.ln(10)
    pdf.cell(text="Skills: Python, React, SQL, Machine Learning")
    pdf.ln(10)
    pdf.cell(text="EDUCATION")
    pdf.ln(8)
    pdf.cell(text="B.Tech in Computer Science, State University, 2024")
    return bytes(pdf.output())


def test_parse_resume_non_pdf_file_returns_400():
    # Attempt upload of a .txt file
    files = {
        "file": ("notes.txt", b"This is plain text notes", "text/plain")
    }
    response = client.post("/parse-resume", files=files)
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"] or "Invalid Content-Type" in response.json()["detail"]


def test_parse_resume_valid_pdf_success():
    pdf_bytes = generate_sample_pdf_bytes()
    files = {
        "file": ("resume.pdf", pdf_bytes, "application/pdf")
    }
    response = client.post("/parse-resume", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "skills" in data
    assert "education" in data
    assert "experience" in data
    assert "raw_text" in data
    assert "word_count" in data
    assert data["word_count"] > 0

    skills = data["skills"]
    assert "Python" in skills
    assert "React" in skills
    assert "SQL" in skills
    assert "Machine Learning" in skills

    # Verify education parsing
    assert any("B.Tech" in edu["degree"] and "2024" in edu["year"] for edu in data["education"])


def test_parse_resume_no_file_returns_422():
    response = client.post("/parse-resume")
    assert response.status_code == 422

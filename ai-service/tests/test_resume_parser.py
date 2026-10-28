import io
import pytest
from unittest.mock import MagicMock
from app.services.resume_parser import ResumeParser


@pytest.fixture
def parser():
    return ResumeParser()


def test_extract_skills_canonical_and_aliases(parser):
    sample_text = (
        "Experienced software developer. Proficient in ML, ReactJS, and Postgres. "
        "Also familiar with Docker, Python, and K8s."
    )
    skills = parser.extract_skills(sample_text)

    # Alias resolution verification:
    # ML -> Machine Learning
    # ReactJS -> React
    # Postgres -> PostgreSQL
    # K8s -> Kubernetes
    assert "Machine Learning" in skills
    assert "React" in skills
    assert "PostgreSQL" in skills
    assert "Kubernetes" in skills
    assert "Python" in skills
    assert "Docker" in skills
    # Ensure deduplicated and sorted
    assert skills == sorted(list(set(skills)))


def test_extract_skills_no_false_positive_partial_words(parser):
    # 'Grammar' contains 'r', but should NOT match 'R'
    # 'Framework' contains 'r', but should NOT match 'R'
    # 'Operating' contains 'c' or similar, shouldn't match 'C'
    text_without_skills = "Good grammar and thorough understanding of organizational concepts."
    skills = parser.extract_skills(text_without_skills)
    assert "R" not in skills
    assert "C" not in skills

    # Explicit standalone 'R' and 'C' should match
    text_with_r_and_c = "Proficient in programming languages C and R."
    matched = parser.extract_skills(text_with_r_and_c)
    assert "R" in matched
    assert "C" in matched


def test_extract_education(parser):
    sample_education_text = """
John Doe
Software Engineer

EDUCATION
B.Tech in Computer Science, National Institute of Technology, 2024
Diploma in Information Technology, Government Polytechnic, 2020

EXPERIENCE
Software Intern at TechCorp, Jun 2023 - Aug 2023
    """
    education = parser.extract_education(sample_education_text)
    assert len(education) >= 2

    # Check first entry
    assert any("B.Tech" in e["degree"] and "2024" in e["year"] for e in education)
    # Check second entry
    assert any("Diploma" in e["degree"] and "2020" in e["year"] for e in education)


def test_extract_experience(parser):
    sample_experience_text = """
EXPERIENCE
Software Engineering Intern - Google
May 2023 - August 2023
• Built distributed caching service using Redis and Go.
• Improved query response times by 35%.

Full Stack Developer - Acme Solutions
Jan 2022 - Dec 2022
• Developed modern UI with React and Tailwind CSS.

SKILLS
Python, Java, Go, Redis
    """
    experience = parser.extract_experience(sample_experience_text)
    assert len(experience) >= 2

    first = experience[0]
    assert "May 2023 - August 2023" in first["duration"]
    assert "Redis" in first["description"]

    second = experience[1]
    assert "Jan 2022 - Dec 2022" in second["duration"]
    assert "React" in second["description"]


def test_parse_handles_corrupted_empty_bytes(parser):
    # Empty byte string
    res_empty = parser.parse(b"")
    assert "error" in res_empty
    assert res_empty["skills"] == []
    assert res_empty["education"] == []
    assert res_empty["experience"] == []
    assert res_empty["raw_text"] == ""
    assert res_empty["word_count"] == 0

    # Corrupted / invalid PDF header bytes
    res_corrupted = parser.parse(b"NOT_A_VALID_PDF_HEADER_DATA_123456789")
    assert "error" in res_corrupted
    assert res_corrupted["skills"] == []
    assert res_corrupted["education"] == []
    assert res_corrupted["experience"] == []


def test_extract_text_mocked_pdfplumber(parser, monkeypatch):
    fake_page = MagicMock()
    fake_page.extract_text.return_value = "Candidate Resume Text\nSkills: Python, React"

    fake_pdf = MagicMock()
    fake_pdf.pages = [fake_page]
    fake_pdf.__enter__.return_value = fake_pdf
    fake_pdf.__exit__.return_value = None

    monkeypatch.setattr("pdfplumber.open", lambda *args, **kwargs: fake_pdf)

    extracted = parser.extract_text_from_pdf(b"dummy pdf bytes")
    assert "Candidate Resume Text" in extracted
    assert "Skills: Python, React" in extracted

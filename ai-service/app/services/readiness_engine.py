"""
Placement Readiness Scoring Engine for CareerBridge AI.
Calculates an explainable, normalized 0-100 readiness score based on:
1. Resume quality and completeness (20%)
2. Technical skills and proficiency (25%)
3. Academic and eligibility standing (15%)
4. Core CS and coding practice progress (20%)
5. Preparation milestones and mock interview experience (20%)

Does not fabricate missing information. Clearly explains every component.
"""

from typing import Any
import math


def calculate_placement_readiness(
    profile: dict[str, Any],
    resume_analysis: dict[str, Any] | None = None,
    coding_stats: dict[str, Any] | None = None,
    mock_interview_stats: dict[str, Any] | None = None,
    roadmap_stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    factors: list[dict[str, Any]] = []
    improvements: list[str] = []

    # -------------------------------------------------------------
    # 1. Resume Quality & Completeness (Max 20 pts)
    # -------------------------------------------------------------
    resume_score = 0.0
    resume_max = 20.0
    has_resume = bool(resume_analysis and resume_analysis.get("word_count", 0) > 0)

    if not has_resume:
        improvements.append("Upload and parse a comprehensive PDF resume to earn up to 20 readiness points.")
        factors.append({
            "category": "Resume Quality",
            "score": 0.0,
            "max_score": resume_max,
            "status": "Missing",
            "details": "No parsed resume file available on record.",
        })
    else:
        word_count = int(resume_analysis.get("word_count", 0))
        skills_extracted = len(resume_analysis.get("skills", []))
        education_found = len(resume_analysis.get("education", [])) > 0
        exp_found = len(resume_analysis.get("experience", [])) > 0

        # Base presence
        resume_score += 5.0
        # Word count appropriateness (300 - 900 words ideal)
        if 250 <= word_count <= 1000:
            resume_score += 5.0
        elif word_count > 0:
            resume_score += 2.5
            improvements.append(f"Resume length is {word_count} words; aim for 350-700 concise words with bullet points.")

        # Structure sections
        if education_found:
            resume_score += 5.0
        else:
            improvements.append("Ensure your Education section includes degree, institution, and graduation year.")

        if exp_found or skills_extracted >= 5:
            resume_score += 5.0
        else:
            resume_score += 2.0
            improvements.append("Add detailed project or internship bullet points to demonstrate practical implementation.")

        factors.append({
            "category": "Resume Quality",
            "score": round(resume_score, 1),
            "max_score": resume_max,
            "status": "Strong" if resume_score >= 15 else "Adequate" if resume_score >= 10 else "Needs Work",
            "details": f"Parsed {word_count} words, {skills_extracted} detected skills, structured education and project sections.",
        })

    # -------------------------------------------------------------
    # 2. Technical Skills & Diversity (Max 25 pts)
    # -------------------------------------------------------------
    skills_score = 0.0
    skills_max = 25.0
    student_skills = profile.get("skills", [])
    if isinstance(student_skills, str):
        student_skills = [s.strip() for s in student_skills.split(",") if s.strip()]

    # Combine with resume skills
    all_skills = set(s.lower() for s in student_skills)
    if resume_analysis and "skills" in resume_analysis:
        for s in resume_analysis["skills"]:
            all_skills.add(s.lower())

    skill_count = len(all_skills)
    if skill_count == 0:
        improvements.append("Add key technical programming languages, frameworks, and databases to your profile.")
    else:
        # Base count points (up to 12 pts)
        skills_score += min(12.0, skill_count * 1.5)

        # Domain diversity checks (up to 9 pts)
        languages = {"python", "java", "c++", "javascript", "typescript", "c", "c#", "go", "rust"}
        frameworks = {"react", "angular", "vue", "node.js", "express", "django", "flask", "fastapi", "spring boot", "next.js"}
        databases_cloud = {"sql", "mysql", "postgresql", "mongodb", "redis", "docker", "aws", "git", "linux", "kubernetes"}

        has_lang = any(s in languages for s in all_skills)
        has_framework = any(s in frameworks for s in all_skills)
        has_db_cloud = any(s in databases_cloud for s in all_skills)

        if has_lang:
            skills_score += 3.0
        else:
            improvements.append("Include at least one foundational core programming language (e.g. Python, Java, or C++).")

        if has_framework:
            skills_score += 3.0
        else:
            improvements.append("Add web or application frameworks (e.g. React, Node.js, Spring Boot, FastAPI) to show full-stack capability.")

        if has_db_cloud:
            skills_score += 3.0
        else:
            improvements.append("Highlight database and DevOps tools (SQL, MongoDB, Git, Docker) essential for hiring rounds.")

    # Certifications bonus (up to 4 pts)
    cert_count = int(profile.get("certifications", 0))
    skills_score += min(4.0, cert_count * 1.5)
    skills_score = min(skills_max, skills_score)

    factors.append({
        "category": "Technical Skills & Breadth",
        "score": round(skills_score, 1),
        "max_score": skills_max,
        "status": "Strong" if skills_score >= 18 else "Adequate" if skills_score >= 11 else "Needs Work",
        "details": f"{skill_count} unique technical competencies across core languages, frameworks, and tools.",
    })

    # -------------------------------------------------------------
    # 3. Academic & Eligibility Standing (Max 15 pts)
    # -------------------------------------------------------------
    academic_score = 0.0
    academic_max = 15.0
    cgpa = float(profile.get("cgpa", 0.0) or 0.0)
    backlogs = int(profile.get("backlogs", 0) or 0)

    # CGPA component (up to 12 pts)
    if cgpa >= 8.5:
        academic_score += 12.0
    elif cgpa >= 7.5:
        academic_score += 10.0
    elif cgpa >= 6.5:
        academic_score += 7.5
    elif cgpa > 0.0:
        academic_score += max(3.0, (cgpa / 10.0) * 8.0)
    else:
        academic_score += 0.0
        improvements.append("Update your CGPA in your profile to accurately calculate drive eligibility.")

    # Backlog component (up to 3 pts)
    if backlogs == 0:
        academic_score += 3.0
    else:
        improvements.append(f"Clear active backlogs ({backlogs} recorded) to unlock premier company eligibility criteria.")

    factors.append({
        "category": "Academic Standing",
        "score": round(academic_score, 1),
        "max_score": academic_max,
        "status": "Strong" if academic_score >= 12 else "Adequate" if academic_score >= 8 else "Needs Work",
        "details": f"CGPA: {cgpa:.2f}/10.0 with {backlogs} active backlog(s).",
    })

    # -------------------------------------------------------------
    # 4. Core CS & Coding Practice Progress (Max 20 pts)
    # -------------------------------------------------------------
    coding_score = 0.0
    coding_max = 20.0
    c_stats = coding_stats or {}
    problems_solved = int(c_stats.get("problems_solved", 0))
    topics_covered = int(c_stats.get("topics_covered", 0))

    if problems_solved >= 50:
        coding_score += 15.0
    elif problems_solved >= 25:
        coding_score += 11.0
    elif problems_solved >= 10:
        coding_score += 7.0
    elif problems_solved > 0:
        coding_score += 4.0
    else:
        improvements.append("Solve DSA and coding problems in Practice Lab / LeetCode to build assessment speed.")

    # Topic coverage bonus (up to 5 pts)
    coding_score += min(5.0, topics_covered * 1.0)
    coding_score = min(coding_max, coding_score)

    factors.append({
        "category": "Coding & DSA Practice",
        "score": round(coding_score, 1),
        "max_score": coding_max,
        "status": "Strong" if coding_score >= 14 else "Adequate" if coding_score >= 8 else "Needs Work",
        "details": f"{problems_solved} coding challenges solved across {topics_covered} core DSA and CS topics.",
    })

    # -------------------------------------------------------------
    # 5. Milestones & Mock Interview (Max 20 pts)
    # -------------------------------------------------------------
    milestone_score = 0.0
    milestone_max = 20.0
    r_stats = roadmap_stats or {}
    roadmap_percent = float(r_stats.get("progress_percent", 0.0))
    # Roadmap completion up to 10 pts
    milestone_score += min(10.0, (roadmap_percent / 100.0) * 10.0)

    m_stats = mock_interview_stats or {}
    interviews_taken = int(m_stats.get("interviews_completed", 0))
    avg_mock_score = float(m_stats.get("avg_score", 0.0))

    if interviews_taken > 0:
        # Scale average mock score (0-100) to 10 pts
        mock_pts = min(10.0, (avg_mock_score / 100.0) * 10.0)
        milestone_score += max(3.0, mock_pts)
    else:
        improvements.append("Complete at least one AI or alumni mock interview to evaluate real-time answer clarity.")

    milestone_score = min(milestone_max, milestone_score)

    factors.append({
        "category": "Preparation Milestones & Mocks",
        "score": round(milestone_score, 1),
        "max_score": milestone_max,
        "status": "Strong" if milestone_score >= 14 else "Adequate" if milestone_score >= 8 else "Needs Work",
        "details": f"Roadmap completion at {roadmap_percent:.0f}%, {interviews_taken} mock interview sessions completed.",
    })

    # -------------------------------------------------------------
    # Total Score Normalization
    # -------------------------------------------------------------
    overall_score = round(resume_score + skills_score + academic_score + coding_score + milestone_score, 1)
    overall_score = max(0.0, min(100.0, overall_score))

    # Readiness Tier
    if overall_score >= 80.0:
        tier = "Placement Ready (Tier-1 / Product Track)"
        readiness_badge = "Excellent"
        summary_verdict = "Your profile exhibits balanced academic, coding, and resume readiness for competitive placement rounds."
    elif overall_score >= 65.0:
        tier = "Well Prepared (Core & Tech Drives)"
        readiness_badge = "Good"
        summary_verdict = "Solid foundational profile. Addressing highlighted gaps will maximize your dream offer opportunities."
    elif overall_score >= 45.0:
        tier = "Developing Readiness (Needs Targeted Effort)"
        readiness_badge = "Developing"
        summary_verdict = "Key foundational elements are in place. Focus on problem-solving practice and project depth."
    else:
        tier = "Early Stage (Build Core Assets)"
        readiness_badge = "Early Stage"
        summary_verdict = "Begin by completing your profile, uploading a verified resume, and establishing a daily coding rhythm."

    # Important prompt requirement: Distinguish preparation score from actual placement probability!
    estimated_placement_probability = round(
        min(95.0, max(15.0, (overall_score * 0.82) + (3.0 if backlogs == 0 else -10.0))), 1
    )

    return {
        "overall_score": overall_score,
        "max_score": 100.0,
        "readiness_tier": tier,
        "readiness_badge": readiness_badge,
        "summary_verdict": summary_verdict,
        "factors": factors,
        "improvements": improvements[:6],
        "distinction_note": (
            "Note: This score reflects preparation readiness and completed milestones, "
            "which differs from an actual placement offer probability influenced by company hiring quotas and on-the-day performance."
        ),
        "estimated_placement_probability": estimated_placement_probability,
    }

"""
Resume ATS Analyzer Engine for CareerBridge AI.
Inspects resume text, sections, bullet points, and keyword density.
Compares against target job description / role profiles without claiming
to be an official third-party ATS. Suggests concrete bullet point improvements
using action verbs and metric frameworks (X-Y-Z formula) without fabricating facts.
"""

from typing import Any
import re
from app.services.skill_taxonomy import CANONICAL_SKILLS, SKILL_ALIASES

# Action verbs commonly expected in impactful technical resumes
STRONG_ACTION_VERBS = {
    "architected", "engineered", "implemented", "developed", "deployed",
    "optimized", "refactored", "automated", "designed", "built",
    "integrated", "spearheaded", "accelerated", "reduced", "scaled",
    "orchestrated", "migrated", "collaborated", "managed", "delivered",
    "formulated", "debugged", "benchmarked", "analyzed", "published",
    "created", "configured", "maintained", "secured", "streamlined",
}

WEAK_VAGUE_PHRASES = [
    ("worked on", "specify whether you architected, coded, debugged, or deployed the module"),
    ("responsible for", "replace with direct action verbs such as 'led', 'delivered', or 'executed'"),
    ("helped with", "clarify your exact individual contribution and technology role"),
    ("assisted in", "state the specific sub-system or feature you designed and tested"),
    ("handled", "specify the technical challenges overcome or scale handled"),
    ("familiar with", "demonstrate proficiency through specific projects or libraries used"),
    ("various tasks", "list the concrete technical deliverables achieved"),
]

EXPECTED_SECTIONS = [
    ("Contact Information", [r"email", r"github", r"linkedin", r"phone", r"\+91", r"@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"]),
    ("Education", [r"\beducation\b", r"\bacademics?\b", r"\bb\.?tech\b", r"\bdegree\b", r"\buniversity\b", r"\bcollege\b"]),
    ("Technical Skills", [r"\bskills?\b", r"\btechnical\s+skills?\b", r"\btechnologies\b", r"\btools?\b", r"\bcompetencies\b"]),
    ("Projects", [r"\bprojects?\b", r"\bacademic\s+projects?\b", r"\bpersonal\s+projects?\b", r"\bportfolio\b"]),
    ("Experience / Internships", [r"\bexperience\b", r"\binternships?\b", r"\bwork\s+history\b", r"\bemployment\b", r"\bprofessional\s+experience\b"]),
    ("Certifications & Achievements", [r"\bcertifications?\b", r"\bachievements?\b", r"\bawards?\b", r"\bhackathons?\b", r"\bpublications?\b"]),
]

METRIC_PATTERNS = [
    r"\b\d+%",                    # percentages (e.g. 35%)
    r"\b\d+x\b",                  # multipliers (e.g. 10x)
    r"\b\d+\s*(?:ms|sec|seconds|minutes|hours)\b",  # latency/time
    r"\b\d+\s*(?:k|m|million|users|requests|qps|queries|endpoints?)\b",  # scale
    r"\b(?:reduced|increased|improved|boosted|cut)\s+(?:by\s+)?\d+",     # relative gains
]


def analyze_resume_ats(
    raw_text: str,
    parsed_skills: list[str] | None = None,
    education: list[dict[str, Any]] | None = None,
    experience: list[dict[str, Any]] | None = None,
    target_role: str = "Software Engineer",
    target_keywords: list[str] | None = None,
) -> dict[str, Any]:
    text = (raw_text or "").strip()
    words = text.split()
    word_count = len(words)

    # 1. Section Completeness Analysis
    section_results: list[dict[str, Any]] = []
    missing_sections: list[str] = []
    sections_found_count = 0

    lower_text = text.lower()
    for section_name, patterns in EXPECTED_SECTIONS:
        found = any(re.search(pat, lower_text, re.IGNORECASE) for pat in patterns)
        if found:
            sections_found_count += 1
            section_results.append({
                "section": section_name,
                "status": "Present",
                "importance": "Mandatory" if section_name in ["Contact Information", "Education", "Technical Skills", "Projects"] else "Recommended",
            })
        else:
            missing_sections.append(section_name)
            section_results.append({
                "section": section_name,
                "status": "Missing",
                "importance": "Mandatory" if section_name in ["Contact Information", "Education", "Technical Skills", "Projects"] else "Recommended",
            })

    # Section score: up to 30 pts
    section_score = round((sections_found_count / len(EXPECTED_SECTIONS)) * 30.0, 1)

    # 2. Length & Formatting Heuristics (up to 20 pts)
    formatting_score = 20.0
    formatting_notes: list[str] = []

    if word_count < 250:
        deduction = 10.0
        formatting_score -= deduction
        formatting_notes.append(f"Resume is very brief ({word_count} words). Ideal technical resume is 350-700 words.")
    elif word_count > 1200:
        deduction = 8.0
        formatting_score -= deduction
        formatting_notes.append(f"Resume is lengthy ({word_count} words). Aim for a focused 1-page format (under 800 words) for campus hiring.")
    else:
        formatting_notes.append("Resume word count is in the optimal 1-page zone (350-800 words).")

    # Lines & bullet detection
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    bullet_lines = [l for l in lines if l.startswith(("•", "-", "*", "–", "—")) or re.match(r"^\d+\.", l)]
    if len(bullet_lines) >= 6:
        formatting_notes.append("Good bullet-point structure detected for scannability.")
    else:
        formatting_score = max(5.0, formatting_score - 4.0)
        formatting_notes.append("Use bullet points for projects and experiences instead of multi-sentence paragraphs.")

    # 3. Action Verb & Impact Quantification Analysis (up to 25 pts)
    content_score = 0.0
    detected_action_verbs: set[str] = set()
    for verb in STRONG_ACTION_VERBS:
        if re.search(rf"\b{verb}\b", lower_text):
            detected_action_verbs.add(verb)

    # Action verb points (up to 12 pts)
    action_verb_count = len(detected_action_verbs)
    content_score += min(12.0, action_verb_count * 1.5)

    # Quantified metric detection (up to 13 pts)
    metric_matches = 0
    for pat in METRIC_PATTERNS:
        matches = re.findall(pat, lower_text, re.IGNORECASE)
        metric_matches += len(matches)

    content_score += min(13.0, metric_matches * 3.0)
    content_score = round(content_score, 1)

    # Vague phrase identification and bullet suggestions
    vague_phrases_found: list[dict[str, str]] = []
    for phrase, advice in WEAK_VAGUE_PHRASES:
        if phrase in lower_text:
            vague_phrases_found.append({
                "phrase": phrase,
                "suggestion": advice,
            })

    # Generate concrete bullet rewrite examples based on actual text
    bullet_suggestions: list[dict[str, str]] = []
    # Identify 2-3 lines with weak language or missing metrics to suggest improvements
    for line in lines[:40]:
        if len(line) > 25 and len(line) < 140:
            for phrase, _ in WEAK_VAGUE_PHRASES:
                if phrase in line.lower():
                    # Generate an improved formula outline: [Action Verb] + [What you did/Tech] + [Measurable Result]
                    bullet_suggestions.append({
                        "original": line,
                        "critique": f"Contains passive phrase '{phrase}' without measurable outcome.",
                        "recommended_pattern": "Engineered [Module/Feature] using [Technology], improving [Performance/Speed/Reliability] by [X]%.",
                    })
                    break
        if len(bullet_suggestions) >= 3:
            break

    if not bullet_suggestions and len(lines) > 5:
        bullet_suggestions.append({
            "original": "Standard project description",
            "critique": "Quantify outcomes with the Google X-Y-Z formula: 'Accomplished [X] as measured by [Y], by doing [Z]'.",
            "recommended_pattern": "Architected full-stack authentication using JWT & Redis, reducing login verification latency by 40%.",
        })

    # 4. Keyword Match & Role Alignment (up to 25 pts)
    target_kw = [k.strip() for k in (target_keywords or []) if k.strip()]
    if not target_kw:
        # Default role keywords based on target_role
        role_map = {
            "Software Engineer": ["Data Structures", "Algorithms", "Git", "REST APIs", "Debugging", "SQL", "OOP"],
            "Full Stack Developer": ["React", "Node.js", "JavaScript", "HTML", "CSS", "SQL", "REST APIs", "Git"],
            "Data Analyst": ["Python", "SQL", "Pandas", "Excel", "Data Visualization", "Tableau", "Statistics"],
            "Backend Developer": ["API Design", "SQL", "Databases", "Microservices", "Docker", "Authentication"],
            "Frontend Developer": ["React", "JavaScript", "TypeScript", "CSS", "Responsive Design", "State Management"],
        }
        target_kw = role_map.get(target_role, ["Algorithms", "Problem Solving", "Software Engineering", "Git", "SQL"])

    matched_keywords: list[str] = []
    missing_keywords: list[str] = []
    for kw in target_kw:
        # Boundary-aware check
        if re.search(rf"(?<![a-zA-Z0-9]){re.escape(kw)}(?![a-zA-Z0-9])", text, re.IGNORECASE):
            matched_keywords.append(kw)
        else:
            missing_keywords.append(kw)

    keyword_score = round((len(matched_keywords) / max(1, len(target_kw))) * 25.0, 1)

    # Total Overall Score
    total_ats_score = round(section_score + formatting_score + content_score + keyword_score, 1)
    total_ats_score = max(10.0, min(100.0, total_ats_score))

    # Overall Summary
    if total_ats_score >= 82.0:
        assessment = "Strong ATS Compatibility"
        summary_text = "Your resume exhibits solid section structure, active technical verbs, and relevant role keywords."
    elif total_ats_score >= 65.0:
        assessment = "Moderate ATS Compatibility"
        summary_text = "The resume is readable by standard parsers, but lacks quantified metrics or key domain keywords."
    else:
        assessment = "Low ATS Compatibility — Action Required"
        summary_text = "Missing critical sections or technical keywords. Standard automated resume screeners may misclassify your skills."

    return {
        "ats_score": total_ats_score,
        "max_score": 100.0,
        "assessment": assessment,
        "summary": summary_text,
        "word_count": word_count,
        "score_breakdown": {
            "section_completeness": {"score": section_score, "max": 30.0},
            "formatting_and_length": {"score": formatting_score, "max": 20.0},
            "action_verbs_and_impact": {"score": content_score, "max": 25.0},
            "keyword_alignment": {"score": keyword_score, "max": 25.0},
        },
        "sections": section_results,
        "missing_sections": missing_sections,
        "detected_action_verbs": sorted(detected_action_verbs),
        "vague_phrases": vague_phrases_found,
        "bullet_suggestions": bullet_suggestions,
        "keywords": {
            "target_role": target_role,
            "matched": matched_keywords,
            "missing": missing_keywords,
            "coverage_percent": round((len(matched_keywords) / max(1, len(target_kw))) * 100.0, 1),
        },
        "formatting_notes": formatting_notes,
        "disclaimer": (
            "Disclaimer: This analysis evaluates structural parsing readability, quantified phrasing, "
            "and keyword frequency using industry heuristics. It is not an official vendor ATS result."
        ),
    }

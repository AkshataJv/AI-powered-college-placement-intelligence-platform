import io
import re
import logging
from typing import Any
import pdfplumber

from app.services.skill_taxonomy import CANONICAL_SKILLS, SKILL_ALIASES

logger = logging.getLogger("careerbridge-ai.resume_parser")


class ResumeParser:
    """
    Stateless, in-memory parser for resume PDFs.
    Extracts raw text, technical/soft skills, education, and experience.
    """

    def __init__(self):
        # Precompile skill matching patterns
        self._compiled_patterns = self._build_skill_patterns()

    def _build_skill_patterns(self) -> list[tuple[re.Pattern, str]]:
        """
        Build compiled regex patterns for canonical skills and aliases.
        Uses boundary assertions (?<![a-zA-Z0-9]) and (?![a-zA-Z0-9])
        to accurately support symbols in names (like C++, C#, .NET, Node.js)
        without matching partial words (e.g. 'R' inside 'Grammar').
        """
        patterns = []
        
        # Merge canonical skills and aliases, prioritizing longer phrases first
        mapping: dict[str, str] = {}
        for skill in CANONICAL_SKILLS:
            mapping[skill] = skill
        for alias, canonical in SKILL_ALIASES.items():
            mapping[alias] = canonical

        # Sort by length descending to match multi-word phrases before individual words
        sorted_terms = sorted(mapping.keys(), key=lambda t: len(t), reverse=True)

        for term in sorted_terms:
            canonical = mapping[term]
            escaped = re.escape(term)
            # Use lookbehind and lookahead to ensure whole-word boundaries
            pattern_str = rf"(?<![a-zA-Z0-9]){escaped}(?![a-zA-Z0-9])"
            regex = re.compile(pattern_str, re.IGNORECASE)
            patterns.append((regex, canonical))

        return patterns

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """
        Extract plain text from PDF bytes in-memory using pdfplumber.
        Never writes to disk.
        """
        if not file_bytes:
            raise ValueError("Empty file bytes provided")

        text_pages: list[str] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                return ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_pages.append(page_text.strip())

        return "\n\n".join(text_pages).strip()

    def extract_skills(self, text: str) -> list[str]:
        """
        Extract canonical skills from text using word-boundary-aware matching
        against the taxonomy and alias dictionary.
        Returns a deduplicated, alphabetically sorted list of canonical skill names.
        """
        if not text:
            return []

        matched_skills: set[str] = set()
        for regex, canonical in self._compiled_patterns:
            if regex.search(text):
                matched_skills.add(canonical)

        return sorted(matched_skills)

    def extract_education(self, text: str) -> list[dict[str, Any]]:
        """
        Extract education entries from resume text using section heuristics
        and degree/year pattern matching.
        """
        if not text:
            return []

        # Find education section
        section_pattern = re.compile(
            r"(?:^|\n)\s*(?:EDUCATION|ACADEMIC BACKGROUND|ACADEMICS|ACADEMIC DETAILS|EDUCATION AND QUALIFICATIONS)[\s:]*\n",
            re.IGNORECASE,
        )
        match = section_pattern.search(text)
        if not match:
            # Fallback: check for standalone header line
            lines = text.splitlines()
            start_idx = -1
            for idx, line in enumerate(lines):
                cleaned = line.strip().upper()
                if cleaned in ("EDUCATION", "ACADEMIC BACKGROUND", "ACADEMICS", "ACADEMIC DETAILS"):
                    start_idx = idx + 1
                    break
            if start_idx == -1:
                return []
            section_lines = lines[start_idx:]
        else:
            section_text = text[match.end():]
            section_lines = section_text.splitlines()

        # Stop at the next major section header
        next_section_pattern = re.compile(
            r"^\s*(?:EXPERIENCE|WORK EXPERIENCE|INTERNSHIPS?|PROJECTS|SKILLS|TECHNICAL SKILLS|CERTIFICATIONS|ACHIEVEMENTS|PUBLICATIONS|AWARDS|DECLARATION|SUMMARY|OBJECTIVE)\b",
            re.IGNORECASE,
        )

        extracted_lines: list[str] = []
        for line in section_lines:
            stripped = line.strip()
            if not stripped:
                continue
            if next_section_pattern.match(stripped) and stripped.isupper():
                break
            # Also break if line looks like another all-caps section header (>= 4 chars, no lower case)
            if len(stripped) >= 4 and stripped.isupper() and not any(c.isdigit() for c in stripped) and any(header in stripped for header in ["EXPERIENCE", "PROJECT", "SKILL", "CERTIF", "ACHIEVE"]):
                break
            extracted_lines.append(stripped)

        if not extracted_lines:
            return []

        degree_keywords = [
            r"B\.?\s*Tech(?:\.?)",
            r"B\.?\s*E(?:\.?)",
            r"Bachelor(?:'s)?(?:\s+of\s+[\w\s]+)?",
            r"M\.?\s*Tech(?:\.?)",
            r"M\.?\s*E(?:\.?)",
            r"Master(?:'s)?(?:\s+of\s+[\w\s]+)?",
            r"M\.?\s*B\.?\s*A",
            r"M\.?\s*C\.?\s*A",
            r"B\.?\s*C\.?\s*A",
            r"B\.?\s*S\.?C?",
            r"Diploma",
            r"HSC",
            r"SSC",
            r"12th(?:\s+Grade|\s+Standard)?",
            r"10th(?:\s+Grade|\s+Standard)?",
            r"High\s+School",
            r"Secondary\s+School",
            r"Ph\.?\s*D",
        ]
        degree_regex = re.compile(r"\b(" + "|".join(degree_keywords) + r")\b", re.IGNORECASE)
        year_regex = re.compile(r"\b(199\d|20[0-2]\d|2030)\b")

        entries: list[dict[str, Any]] = []

        for line in extracted_lines:
            year_match = year_regex.search(line)
            degree_match = degree_regex.search(line)

            # If either degree or year or relevant academic indicator is present
            if degree_match or year_match or any(k in line.lower() for k in ["university", "college", "institute", "school"]):
                year_str = year_match.group(1) if year_match else ""
                degree_str = degree_match.group(1).strip() if degree_match else ""

                # Derive institution by stripping degree and year
                institution_str = line
                if degree_match:
                    institution_str = institution_str[:degree_match.start()] + institution_str[degree_match.end():]
                if year_match:
                    institution_str = institution_str.replace(year_str, "")

                # Clean up punctuation and whitespace
                institution_str = re.sub(r"[,|\-–—()\[\]]+", " ", institution_str).strip()
                institution_str = re.sub(r"\s+", " ", institution_str)

                entries.append({
                    "degree": degree_str,
                    "institution": institution_str,
                    "year": year_str,
                })

        return entries

    def extract_experience(self, text: str) -> list[dict[str, Any]]:
        """
        Extract professional experience/internships from resume text using section heuristics,
        date range detections, and bullet grouping.
        """
        if not text:
            return []

        section_pattern = re.compile(
            r"(?:^|\n)\s*(?:WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE|INTERNSHIPS?|EMPLOYMENT HISTORY)[\s:]*\n",
            re.IGNORECASE,
        )
        match = section_pattern.search(text)
        if not match:
            # Fallback
            lines = text.splitlines()
            start_idx = -1
            for idx, line in enumerate(lines):
                cleaned = line.strip().upper()
                if cleaned in ("EXPERIENCE", "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE", "INTERNSHIPS", "INTERNSHIP"):
                    start_idx = idx + 1
                    break
            if start_idx == -1:
                return []
            section_lines = lines[start_idx:]
        else:
            section_text = text[match.end():]
            section_lines = section_text.splitlines()

        next_section_pattern = re.compile(
            r"^\s*(?:EDUCATION|PROJECTS|ACADEMIC PROJECTS|SKILLS|TECHNICAL SKILLS|CERTIFICATIONS|ACHIEVEMENTS|PUBLICATIONS|AWARDS|DECLARATION)\b",
            re.IGNORECASE,
        )

        extracted_lines: list[str] = []
        for line in section_lines:
            stripped = line.strip()
            if not stripped:
                continue
            if next_section_pattern.match(stripped) and stripped.isupper():
                break
            if len(stripped) >= 4 and stripped.isupper() and any(header in stripped for header in ["EDUCATION", "PROJECT", "SKILL", "CERTIF", "ACHIEVE"]):
                break
            extracted_lines.append(stripped)

        if not extracted_lines:
            return []

        # Date range regex (e.g., Jun 2023 - Aug 2023, 2022 - Present, May 2021 to July 2022)
        date_range_regex = re.compile(
            r"(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.'-]*\d{4}|\d{4})\s*(?:-|–|—|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.'-]*\d{4}|\d{4}|Present|Current)",
            re.IGNORECASE,
        )

        entries: list[dict[str, Any]] = []
        current_entry: dict[str, Any] | None = None

        for line in extracted_lines:
            date_match = date_range_regex.search(line)
            is_bullet = bool(re.match(r"^[\s*\-•>]+", line))

            if date_match and not is_bullet:
                duration = date_match.group(0).strip()
                line_without_date = line[:date_match.start()] + line[date_match.end():]
                line_without_date = re.sub(r"[,|\-–—()\[\]]+", " ", line_without_date).strip()
                parts = [p.strip() for p in re.split(r"\s{2,}| at | @ | - ", line_without_date) if p.strip()]

                # If current_entry exists and doesn't have a duration yet, attach duration to it
                if current_entry and not current_entry["duration"]:
                    current_entry["duration"] = duration
                    if not current_entry["organization"] and parts:
                        current_entry["organization"] = parts[0]
                    # Attempt splitting title into title and org if needed
                    for sep in [" - ", " at ", " @ "]:
                        if sep in current_entry["title"]:
                            t_parts = current_entry["title"].split(sep, 1)
                            current_entry["title"] = t_parts[0].strip()
                            current_entry["organization"] = t_parts[1].strip()
                            break
                else:
                    if current_entry:
                        current_entry["description"] = " ".join(current_entry["description"]).strip()
                        entries.append(current_entry)

                    title = parts[0] if parts else ""
                    organization = parts[1] if len(parts) > 1 else ""
                    current_entry = {
                        "title": title,
                        "organization": organization,
                        "duration": duration,
                        "description": [],
                    }
            elif current_entry is not None:
                if is_bullet:
                    cleaned_line = re.sub(r"^[\s*\-•>]+", "", line).strip()
                    if cleaned_line:
                        current_entry["description"].append(cleaned_line)
                elif current_entry["description"] or current_entry["duration"]:
                    # A non-bullet line when we already have description/duration means a new job entry begins
                    current_entry["description"] = " ".join(current_entry["description"]).strip()
                    entries.append(current_entry)
                    title = line
                    org = ""
                    for sep in [" - ", " at ", " @ "]:
                        if sep in line:
                            t_parts = line.split(sep, 1)
                            title = t_parts[0].strip()
                            org = t_parts[1].strip()
                            break
                    current_entry = {
                        "title": title,
                        "organization": org,
                        "duration": "",
                        "description": [],
                    }
                else:
                    if not current_entry["organization"]:
                        current_entry["organization"] = line
                    else:
                        current_entry["description"].append(line)
            else:
                if not is_bullet and len(line) < 100:
                    title = line
                    org = ""
                    for sep in [" - ", " at ", " @ "]:
                        if sep in line:
                            t_parts = line.split(sep, 1)
                            title = t_parts[0].strip()
                            org = t_parts[1].strip()
                            break
                    current_entry = {
                        "title": title,
                        "organization": org,
                        "duration": "",
                        "description": [],
                    }

        if current_entry:
            current_entry["description"] = " ".join(current_entry["description"]).strip()
            entries.append(current_entry)

        return entries

    def parse(self, file_bytes: bytes) -> dict[str, Any]:
        """
        Orchestrate resume parsing from PDF bytes.
        Returns:
            {
                "raw_text": str,
                "word_count": int,
                "skills": list[str],
                "education": list[dict],
                "experience": list[dict],
            }
        Gracefully handles corrupted or unreadable files by returning an "error" key.
        """
        try:
            raw_text = self.extract_text_from_pdf(file_bytes)
        except Exception as exc:
            logger.warning("PDF extraction failed: %s", exc)
            return {
                "raw_text": "",
                "word_count": 0,
                "skills": [],
                "education": [],
                "experience": [],
                "error": f"Failed to extract text from PDF: {str(exc)}",
            }

        word_count = len(raw_text.split()) if raw_text else 0
        skills = self.extract_skills(raw_text)
        education = self.extract_education(raw_text)
        experience = self.extract_experience(raw_text)

        return {
            "raw_text": raw_text,
            "word_count": word_count,
            "skills": skills,
            "education": education,
            "experience": experience,
        }

import logging
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.services.embedding_model import embed_texts
from app.services.skill_taxonomy import SKILL_ALIASES

logger = logging.getLogger("careerbridge-ai.skill_matcher")


class SkillMatcher:
    """
    Stateless semantic skill matching engine using sentence embeddings.
    Computes cosine similarity matrices, performs category matching (required,
    preferred, keywords) with proportional weight redistribution, and generates
    natural language match summaries.
    """

    @staticmethod
    def _prepare_skill_text(skill: str) -> str:
        """
        Enrich abbreviations and aliases with their canonical domain names
        (e.g. 'ML' -> 'ML (Machine Learning)') for higher semantic precision.
        """
        s = skill.strip()
        if not s:
            return ""
        canonical = SKILL_ALIASES.get(s)
        if not canonical:
            for k, v in SKILL_ALIASES.items():
                if k.lower() == s.lower():
                    canonical = v
                    break
        if canonical and canonical.lower() != s.lower():
            return f"{s} ({canonical})"
        return s

    def compute_similarity_matrix(self, set_a: list[str], set_b: list[str]) -> np.ndarray:
        """
        Embeds both lists together in one batch call and returns a 2D cosine
        similarity matrix of shape (len(set_a), len(set_b)).
        Handles empty lists gracefully by returning an empty array.
        """
        len_a = len(set_a)
        len_b = len(set_b)
        if len_a == 0 or len_b == 0:
            return np.empty((len_a, len_b), dtype=np.float32)

        prepared_a = [self._prepare_skill_text(s) for s in set_a]
        prepared_b = [self._prepare_skill_text(s) for s in set_b]
        all_texts = prepared_a + prepared_b

        embeddings = embed_texts(all_texts)
        embs_a = embeddings[:len_a]
        embs_b = embeddings[len_a:]

        sim_matrix = cosine_similarity(embs_a, embs_b)
        return sim_matrix

    def match_skill_set(
        self,
        candidate_skills: list[str],
        target_skills: list[str],
        threshold: float = 0.55,
        sim_matrix: np.ndarray | None = None,
    ) -> dict:
        """
        For each skill in target_skills, finds the candidate skill with highest
        cosine similarity. Classifies as 'matched' if similarity >= threshold,
        else 'missing'.

        Returns:
            {
                "matched": [{"target_skill": str, "best_match": str, "similarity": float}],
                "missing": [{"target_skill": str, "closest_candidate": str | None, "similarity": float}],
                "match_percentage": float
            }
        """
        if not target_skills:
            return {"matched": [], "missing": [], "match_percentage": 0.0}

        if not candidate_skills:
            missing = [
                {"target_skill": skill, "closest_candidate": None, "similarity": 0.0}
                for skill in target_skills
            ]
            return {"matched": [], "missing": missing, "match_percentage": 0.0}

        if sim_matrix is None:
            sim_matrix = self.compute_similarity_matrix(target_skills, candidate_skills)

        matched: list[dict] = []
        missing: list[dict] = []

        for i, target_skill in enumerate(target_skills):
            row = sim_matrix[i]
            best_idx = int(np.argmax(row))
            best_score = float(row[best_idx])
            best_candidate = candidate_skills[best_idx]
            sim_val = round(best_score, 4)

            if best_score >= threshold:
                matched.append({
                    "target_skill": target_skill,
                    "best_match": best_candidate,
                    "similarity": sim_val,
                })
            else:
                missing.append({
                    "target_skill": target_skill,
                    "closest_candidate": best_candidate,
                    "similarity": sim_val,
                })

        match_pct = round((len(matched) / len(target_skills)) * 100.0, 2)
        return {
            "matched": matched,
            "missing": missing,
            "match_percentage": match_pct,
        }

    def compute_full_match(
        self,
        candidate_skills: list[str],
        required_skills: list[str],
        preferred_skills: list[str] | None = None,
        keywords: list[str] | None = None,
        threshold: float = 0.55,
        embedding_cache: dict[str, np.ndarray] | None = None,
    ) -> dict:
        """
        Matches candidate skills against required (0.60), preferred (0.25), and
        keywords (0.15). Combines into a weighted semantic_score (0-100).
        Redistributes weights proportionally when any target category is empty.
        Supports precomputed embedding_cache for optimized batch matching.
        """
        preferred_skills = preferred_skills or []
        keywords = keywords or []

        def _get_match(target_list: list[str]) -> dict:
            if not target_list or not candidate_skills:
                return self.match_skill_set(candidate_skills, target_list, threshold=threshold)

            if embedding_cache is not None:
                target_embs = np.array([embedding_cache[s] for s in target_list])
                cand_embs = np.array([embedding_cache[s] for s in candidate_skills])
                sub_sim = cosine_similarity(target_embs, cand_embs)
                return self.match_skill_set(candidate_skills, target_list, threshold=threshold, sim_matrix=sub_sim)

            return self.match_skill_set(candidate_skills, target_list, threshold=threshold)

        req_match = _get_match(required_skills)
        pref_match = _get_match(preferred_skills)
        kw_match = _get_match(keywords)

        results = {
            "required": req_match,
            "preferred": pref_match,
            "keywords": kw_match,
        }

        # Weight definitions
        category_weights = [
            ("required", required_skills, 0.60),
            ("preferred", preferred_skills, 0.25),
            ("keywords", keywords, 0.15),
        ]

        non_empty = [(name, skills, weight) for name, skills, weight in category_weights if len(skills) > 0]
        total_weight = sum(w for _, _, w in non_empty)

        if total_weight > 0:
            semantic_score = sum(
                results[name]["match_percentage"] * (weight / total_weight)
                for name, _, weight in non_empty
            )
            semantic_score = round(semantic_score, 2)
        else:
            semantic_score = 0.0

        return {
            "semantic_score": semantic_score,
            "required": req_match,
            "preferred": pref_match,
            "keywords": kw_match,
        }

    def generate_explanation(self, match_result: dict) -> str:
        """
        Produces a concise 2-3 sentence natural language explanation of match results.
        """
        score = match_result.get("semantic_score", 0.0)
        req_res = match_result.get("required", {})
        pref_res = match_result.get("preferred", {})
        kw_res = match_result.get("keywords", {})

        req_matched = req_res.get("matched", [])
        req_missing = req_res.get("missing", [])
        req_total = len(req_matched) + len(req_missing)

        pref_matched = pref_res.get("matched", [])
        pref_missing = pref_res.get("missing", [])
        pref_total = len(pref_matched) + len(pref_missing)

        # Match level descriptor
        if score >= 75.0:
            descriptor = "Strong match"
        elif score >= 50.0:
            descriptor = "Moderate match"
        elif score > 0.0:
            descriptor = "Low match"
        else:
            descriptor = "No match"

        # Sentence 1: Required skills
        if req_total > 0:
            s1 = f"{descriptor}: {len(req_matched)} of {req_total} required skills found"
            if req_matched:
                matched_names = [m["target_skill"] for m in req_matched[:4]]
                s1 += f" (including {', '.join(matched_names)})"
            s1 += "."
            if req_missing:
                missing_names = [m["target_skill"] for m in req_missing[:3]]
                s1 += f" Missing: {', '.join(missing_names)}."
        else:
            s1 = f"{descriptor}: No specific required skills specified."

        # Sentence 2 & 3: Preferred skills & keywords
        secondary_parts: list[str] = []
        if pref_total > 0:
            p_text = f"{len(pref_matched)} of {pref_total} preferred skills matched"
            if pref_matched:
                pref_names = [m["target_skill"] for m in pref_matched[:3]]
                p_text += f" ({', '.join(pref_names)})"
            p_text += "."
            secondary_parts.append(p_text)

        kw_matched = kw_res.get("matched", [])
        kw_total = len(kw_matched) + len(kw_res.get("missing", []))
        if kw_total > 0 and len(kw_matched) > 0:
            kw_names = [m["target_skill"] for m in kw_matched[:3]]
            secondary_parts.append(f"{len(kw_matched)} of {kw_total} relevant keywords matched ({', '.join(kw_names)}).")

        if secondary_parts:
            return f"{s1} {' '.join(secondary_parts)}"
        return s1

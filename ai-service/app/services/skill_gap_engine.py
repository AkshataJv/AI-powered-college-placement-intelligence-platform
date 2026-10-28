"""
Skill Gap Analysis Engine for CareerBridge AI.
Compares candidate skills against target company/drive requirements or role profiles.
Classifies skills into:
- Matched (direct or high semantic similarity)
- Needs Improvement / Related (moderate semantic similarity)
- Missing (not demonstrated)
Prioritizes gaps and provides curated learning resources, coding topics, and practical tasks.
"""

from typing import Any
import numpy as np
from app.services.skill_matcher import SkillMatcher
from app.services.skill_taxonomy import SKILL_ALIASES

# Curated reference resources for common technical placement skills
SKILL_LEARNING_RESOURCES: dict[str, dict[str, Any]] = {
    "python": {
        "title": "Python Core & Advanced Concepts",
        "platform": "GeeksforGeeks & Python Docs",
        "url": "https://www.geeksforgeeks.org/python-programming-language/",
        "practice_task": "Implement custom data structures (LinkedList, Stack) and write object-oriented CLI tools in Python.",
        "estimated_hours": 12,
    },
    "java": {
        "title": "Java Programming & Collections Framework",
        "platform": "JavaTpoint & Oracle Docs",
        "url": "https://www.geeksforgeeks.org/java/",
        "practice_task": "Master Java Collections (HashMap, PriorityQueue, TreeSet) and concurrency primitives.",
        "estimated_hours": 15,
    },
    "c++": {
        "title": "C++ Standard Template Library (STL)",
        "platform": "GeeksforGeeks C++",
        "url": "https://www.geeksforgeeks.org/c-plus-plus/",
        "practice_task": "Practice STL containers (vector, unordered_map, set) and solve 20 standard DSA problems.",
        "estimated_hours": 14,
    },
    "data structures": {
        "title": "Data Structures & Algorithmic Problem Solving",
        "platform": "NeetCode / Striver SDE Sheet",
        "url": "https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/",
        "practice_task": "Solve Arrays, Two Pointers, Sliding Window, Trees, and Graphs on LeetCode.",
        "estimated_hours": 30,
    },
    "sql": {
        "title": "SQL Mastery & Relational Databases",
        "platform": "SQLZoo & Mode Analytics",
        "url": "https://sqlzoo.net/",
        "practice_task": "Practice JOINs, GROUP BY, Window functions (ROW_NUMBER, DENSE_RANK), and query optimization.",
        "estimated_hours": 10,
    },
    "react": {
        "title": "React 18+ Architecture & State Management",
        "platform": "React Official Docs",
        "url": "https://react.dev/learn",
        "practice_task": "Build an interactive CRUD dashboard with React hooks, context, and optimistic UI updates.",
        "estimated_hours": 16,
    },
    "node.js": {
        "title": "Node.js & Express RESTful API Engineering",
        "platform": "MDN Web Docs",
        "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Express_Nodejs",
        "practice_task": "Develop a REST API with JWT authentication, SQLite/PostgreSQL persistence, and role middleware.",
        "estimated_hours": 15,
    },
    "docker": {
        "title": "Containerization with Docker",
        "platform": "Docker Official Docs",
        "url": "https://docs.docker.com/get-started/",
        "practice_task": "Write multi-stage Dockerfiles and deploy a frontend + backend application with Docker Compose.",
        "estimated_hours": 8,
    },
    "git": {
        "title": "Version Control with Git & GitHub Collaboration",
        "platform": "Pro Git Book",
        "url": "https://git-scm.com/book/en/v2",
        "practice_task": "Practice feature branching, interactive rebasing, merge conflict resolution, and pull requests.",
        "estimated_hours": 6,
    },
    "operating systems": {
        "title": "Core Operating Systems Concepts for Placements",
        "platform": "Gate Smashers / GeeksforGeeks",
        "url": "https://www.geeksforgeeks.org/operating-systems/",
        "practice_task": "Master Process Synchronization, Semaphores, Deadlocks, Paging, and Virtual Memory questions.",
        "estimated_hours": 12,
    },
    "dbms": {
        "title": "Database Management Systems (DBMS) Fundamentals",
        "platform": "GeeksforGeeks DBMS",
        "url": "https://www.geeksforgeeks.org/dbms/",
        "practice_task": "Understand ACID properties, Normalization (1NF to BCNF), indexing B-Trees, and transactions.",
        "estimated_hours": 10,
    },
    "computer networks": {
        "title": "Computer Networks Protocols & Architecture",
        "platform": "GeeksforGeeks Computer Network",
        "url": "https://www.geeksforgeeks.org/computer-network-tutorials/",
        "practice_task": "Review OSI 7 layers, TCP 3-way handshake, HTTP/HTTPS headers, DNS, and IP subnetting.",
        "estimated_hours": 10,
    },
}

matcher = SkillMatcher()


def get_default_resource_for_skill(skill_name: str) -> dict[str, Any]:
    s_lower = skill_name.lower().strip()
    # Check exact
    if s_lower in SKILL_LEARNING_RESOURCES:
        return SKILL_LEARNING_RESOURCES[s_lower]
    # Check alias
    for k, v in SKILL_LEARNING_RESOURCES.items():
        if k in s_lower or s_lower in k:
            return v
    # Fallback
    return {
        "title": f"Mastering {skill_name} Fundamentals",
        "platform": "GeeksforGeeks & Documentation",
        "url": f"https://www.google.com/search?q={skill_name.replace(' ', '+')}+tutorial+geeksforgeeks",
        "practice_task": f"Build a practical mini-project or code module demonstrating practical use of {skill_name}.",
        "estimated_hours": 8,
    }


def perform_skill_gap_analysis(
    candidate_skills: list[str],
    target_company: str = "Campus Drive",
    target_role: str = "Software Engineer",
    required_skills: list[str] | None = None,
    preferred_skills: list[str] | None = None,
) -> dict[str, Any]:
    req_skills = [s.strip() for s in (required_skills or []) if s.strip()]
    pref_skills = [s.strip() for s in (preferred_skills or []) if s.strip()]

    if not req_skills and not pref_skills:
        # Default skills based on role
        if "data" in target_role.lower():
            req_skills = ["Python", "SQL", "Pandas", "Data Structures"]
            pref_skills = ["Machine Learning", "Tableau", "Git"]
        elif "frontend" in target_role.lower():
            req_skills = ["JavaScript", "React", "HTML", "CSS"]
            pref_skills = ["TypeScript", "Tailwind CSS", "Git"]
        else:
            req_skills = ["Data Structures", "Algorithms", "Java", "SQL", "OOP"]
            pref_skills = ["React", "Node.js", "Docker", "Git"]

    # Match against candidate skills using SkillMatcher
    cand_skills_clean = [s.strip() for s in candidate_skills if s.strip()]

    all_target_skills = req_skills + pref_skills
    sim_matrix = matcher.compute_similarity_matrix(all_target_skills, cand_skills_clean)

    matched_list: list[dict[str, Any]] = []
    improvement_list: list[dict[str, Any]] = []
    missing_list: list[dict[str, Any]] = []

    for i, target_skill in enumerate(all_target_skills):
        is_required = target_skill in req_skills
        priority = "Critical" if is_required else "High"

        resource = get_default_resource_for_skill(target_skill)

        if not cand_skills_clean or sim_matrix.size == 0:
            missing_list.append({
                "skill": target_skill,
                "category": "Required" if is_required else "Preferred",
                "priority": priority,
                "similarity": 0.0,
                "closest_skill": None,
                "status": "Missing",
                "recommendation": f"Add {target_skill} to your core preparation.",
                "resource": resource,
            })
            continue

        row = sim_matrix[i]
        best_idx = int(np.argmax(row))
        best_score = float(row[best_idx])
        best_candidate_skill = cand_skills_clean[best_idx]

        item = {
            "skill": target_skill,
            "category": "Required" if is_required else "Preferred",
            "priority": priority,
            "similarity": round(best_score, 3),
            "closest_skill": best_candidate_skill,
            "resource": resource,
        }

        if best_score >= 0.70:
            item["status"] = "Matched"
            item["recommendation"] = f"Strong match verified against your profile skill '{best_candidate_skill}'."
            matched_list.append(item)
        elif best_score >= 0.45:
            item["status"] = "Needs Improvement"
            item["priority"] = "Medium" if not is_required else "High"
            item["recommendation"] = f"Partially demonstrated via related skill '{best_candidate_skill}'. Needs hands-on projects to reach proficiency."
            improvement_list.append(item)
        else:
            item["status"] = "Missing"
            item["recommendation"] = f"Not identified in your current skill profile. High impact for {target_company} {target_role} rounds."
            missing_list.append(item)

    # Sort gaps by priority: Critical -> High -> Medium
    prio_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    missing_list.sort(key=lambda x: prio_order.get(x["priority"], 99))
    improvement_list.sort(key=lambda x: prio_order.get(x["priority"], 99))

    total_target_count = len(all_target_skills)
    match_percentage = round((len(matched_list) / max(1, total_target_count)) * 100.0, 1)

    # Actionable next steps
    next_steps: list[str] = []
    if missing_list:
        top_missing = [m["skill"] for m in missing_list[:3]]
        next_steps.append(f"Priority 1: Dedicate 5-10 study hours to bridge critical gaps: {', '.join(top_missing)}.")
    if improvement_list:
        top_imp = [m["skill"] for m in improvement_list[:2]]
        next_steps.append(f"Priority 2: Deepen practical implementation in {', '.join(top_imp)} through portfolio projects.")
    next_steps.append(f"Priority 3: Review company-specific interview patterns for {target_company}.")

    return {
        "target_company": target_company,
        "target_role": target_role,
        "match_percentage": match_percentage,
        "total_required": len(req_skills),
        "total_preferred": len(pref_skills),
        "matched_skills": matched_list,
        "improvement_skills": improvement_list,
        "missing_skills": missing_list,
        "summary": {
            "matched_count": len(matched_list),
            "improvement_count": len(improvement_list),
            "missing_count": len(missing_list),
        },
        "actionable_next_steps": next_steps,
    }

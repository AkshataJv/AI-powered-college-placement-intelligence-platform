"""
AI Career Roadmap Generator Engine for CareerBridge AI.
Generates personalized career-preparation roadmaps tailored to:
- Academic Year (First Year, Second Year, Third Year, Final Year)
- Target Role (Software Engineer, Full Stack, Data Analyst, Cloud/DevOps, AI/ML)
- Target Company / Profile (Product MNC, IT Services, Fintech, Startup)
- Available Study Time (e.g. 10 hrs/week, 20 hrs/week)
- Existing Skills & Missing Gaps

Produces structured Phases -> Weeks -> Actionable Tasks with resources and priorities.
"""

from typing import Any
import uuid


def generate_career_roadmap(
    academic_year: str = "Third Year",
    target_role: str = "Software Engineer",
    target_company: str = "Target Recruiter",
    current_skills: list[str] | None = None,
    skill_gaps: list[str] | None = None,
    hours_per_week: int = 15,
) -> dict[str, Any]:
    skills = [s.strip() for s in (current_skills or []) if s.strip()]
    gaps = [g.strip() for g in (skill_gaps or []) if g.strip()]
    year = (academic_year or "Third Year").strip()

    # Determine duration & phase focus based on academic year
    if "first" in year.lower():
        duration_weeks = 24
        duration_label = "6 Months (Foundations Track)"
        phase_names = [
            ("Phase 1: Foundations of Programming & Logic", 6),
            ("Phase 2: Fundamental Data Structures & Mathematics", 8),
            ("Phase 3: Exploratory Web/App Development", 6),
            ("Phase 4: Open Source & Basic Problem Solving", 4),
        ]
    elif "second" in year.lower():
        duration_weeks = 20
        duration_label = "5 Months (Core Competency Track)"
        phase_names = [
            ("Phase 1: Advanced Data Structures in C++/Java", 6),
            ("Phase 2: Core CS Fundamentals (DBMS, OS)", 6),
            ("Phase 3: Production Full-Stack Project", 5),
            ("Phase 4: Competitive Coding & Git Portfolio", 3),
        ]
    elif "final" in year.lower():
        duration_weeks = 12
        duration_label = "12 Weeks (Placement Sprint & Mock Track)"
        phase_names = [
            ("Phase 1: High-Frequency LeetCode & Assessment Prep", 3),
            ("Phase 2: Core CS Rapid Revision & SQL Drills", 3),
            ("Phase 3: Company-Specific Interview Patterns", 3),
            ("Phase 4: Resume Polish & Mock Interview Gauntlet", 3),
        ]
    else:  # Third Year (Default / Prime Placement Preparation)
        duration_weeks = 16
        duration_label = "16 Weeks (Placement Readiness Track)"
        phase_names = [
            ("Phase 1: DSA Mastery & Algorithmic Patterns", 5),
            ("Phase 2: Full-Stack Project & System Architecture", 4),
            ("Phase 3: Core CS (OS, DBMS, Networks) & SQL", 4),
            ("Phase 4: Placement Drive Sprints & Technical Mocks", 3),
        ]

    stages: list[dict[str, Any]] = []
    current_week = 1

    for phase_title, week_count in phase_names:
        weeks_list = []
        for w in range(1, week_count + 1):
            tasks = _generate_tasks_for_week(
                week_num=current_week,
                phase_title=phase_title,
                academic_year=year,
                target_role=target_role,
                target_company=target_company,
                gaps=gaps,
                hours=hours_per_week,
            )
            weeks_list.append({
                "week_number": current_week,
                "title": f"Week {current_week}: {_get_week_headline(current_week, phase_title, target_role)}",
                "target_hours": hours_per_week,
                "tasks": tasks,
            })
            current_week += 1

        stages.append({
            "stage_id": str(uuid.uuid4())[:8],
            "title": phase_title,
            "weeks_count": week_count,
            "weeks": weeks_list,
        })

    title = f"{year} {target_role} Preparation Roadmap"
    if target_company and target_company != "Target Recruiter":
        title += f" for {target_company}"

    return {
        "title": title,
        "academic_year": year,
        "target_role": target_role,
        "target_company": target_company,
        "duration": duration_label,
        "total_weeks": duration_weeks,
        "hours_per_week": hours_per_week,
        "stages": stages,
        "progress_percent": 0.0,
        "completed_tasks_count": 0,
        "total_tasks_count": sum(len(w["tasks"]) for s in stages for w in s["weeks"]),
    }


def _get_week_headline(week: int, phase: str, role: str) -> str:
    headlines = {
        1: "Arrays, Two Pointers & Big-O Time Complexity",
        2: "Strings, HashMaps & Sliding Window Patterns",
        3: "Linked Lists, Stacks & Queue Implementations",
        4: "Recursion, Backtracking & Binary Search",
        5: "Binary Trees, BST Traversals & DFS/BFS",
        6: "Heaps, Priority Queues & Sorting Algorithms",
        7: "Dynamic Programming: 1D & 0/1 Knapsack",
        8: "Graphs: BFS, DFS & Shortest Path (Dijkstra)",
        9: "Relational DBMS: Normalization, Indexes & Complex SQL",
        10: "Operating Systems: Processes, Threads & Concurrency",
        11: "Computer Networks: TCP/IP, HTTP/3, DNS & REST APIs",
        12: "System Architecture & High-Level Scalability Basics",
        13: "End-to-End Project Deployment with Docker & CI/CD",
        14: "Company Previous Questions & Online Assessment Practice",
        15: "Resume Bullet Polishing (X-Y-Z) & Behavioral HR Prep",
        16: "Full-Length Mock Technical & HR Interview Sprint",
    }
    return headlines.get(week, f"{phase.split(':')[0]} Core Skills")


def _generate_tasks_for_week(
    week_num: int,
    phase_title: str,
    academic_year: str,
    target_role: str,
    target_company: str,
    gaps: list[str],
    hours: int,
) -> list[dict[str, Any]]:
    tasks = []

    # Inject specific skill gap if relevant
    gap_mention = gaps[(week_num - 1) % len(gaps)] if gaps else None

    # Task 1: Coding / DSA Problem Solving
    task_id_1 = f"t-{week_num}-1"
    tasks.append({
        "id": task_id_1,
        "category": "DSA & Coding",
        "title": f"Solve 5 pattern-based coding problems (Week {week_num} focus)",
        "priority": "High",
        "estimated_hours": max(4, hours // 3),
        "resource_url": "https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/",
        "platform": "LeetCode / Practice Lab",
        "completed": False,
    })

    # Task 2: Core Concept or Project Work
    task_id_2 = f"t-{week_num}-2"
    if "phase 1" in phase_title.lower() or "foundations" in phase_title.lower():
        cat = "Language Fundamentals"
        desc = "Implement 3 clean code exercises and test edge cases."
        res = "https://www.geeksforgeeks.org/"
    elif "phase 2" in phase_title.lower() or "project" in phase_title.lower():
        cat = "Applied Project"
        desc = f"Build and commit a core module for your {target_role} portfolio project."
        res = "https://github.com/"
    elif "core cs" in phase_title.lower() or "dbms" in phase_title.lower():
        cat = "Core CS & SQL"
        desc = "Study 10 high-frequency placement interview questions in OS/DBMS."
        res = "https://sqlzoo.net/"
    else:
        cat = "Company Placement Prep"
        desc = f"Solve 1 previous online assessment simulation for {target_company}."
        res = "https://www.geeksforgeeks.org/tag/interview-experiences/"

    tasks.append({
        "id": task_id_2,
        "category": cat,
        "title": desc,
        "priority": "High",
        "estimated_hours": max(3, hours // 4),
        "resource_url": res,
        "platform": "Curated Guide",
        "completed": False,
    })

    # Task 3: Skill Gap or Interview Prep
    task_id_3 = f"t-{week_num}-3"
    if gap_mention and week_num % 2 == 1:
        tasks.append({
            "id": task_id_3,
            "category": "Skill Gap Bridge",
            "title": f"Study {gap_mention} fundamentals and write a working code sample",
            "priority": "Medium",
            "estimated_hours": max(2, hours // 5),
            "resource_url": f"https://www.google.com/search?q={gap_mention.replace(' ', '+')}+tutorial",
            "platform": "Self-Study",
            "completed": False,
        })
    else:
        tasks.append({
            "id": task_id_3,
            "category": "Interview Readiness",
            "title": "Complete 1 practice session in AI Mock Interview or Aptitude Lab",
            "priority": "Medium",
            "estimated_hours": max(2, hours // 5),
            "resource_url": "/student",
            "platform": "CareerBridge AI",
            "completed": False,
        })

    return tasks

# CareerBridge AI — Database Documentation

## Overview

The project uses **two separate databases** during development:

| Layer | Database | Engine | Used By |
|-------|----------|--------|---------|
| Node.js API | SQLite (`data/career-bridge.sqlite`) | better-sqlite3 | `server/index.js` |
| FastAPI | MySQL (`careerbridge`) | SQLAlchemy + PyMySQL | `backend/app/` |

---

## SQLite Database (Node.js Server)

**File:** `data/career-bridge.sqlite`  
**Schema:** [`sqlite-schema.sql`](./sqlite-schema.sql)  
**Created by:** `server/db.js` automatically on first startup

### Tables
- `users` — accounts with roles: Student, T&P Officer, Alumni
- `drives` — placement drives created by T&P officers
- `resumes` — resume metadata (files in `data/uploads/`)
- `certificates` — student certifications
- `applications` — student-to-drive applications with AI match scores
- `mentorship_requests` — student-to-alumni mentorship
- `interview_slots` — alumni mock interview slots
- `interview_bookings` — student bookings for slots
- `referrals` — alumni referrals for drives
- `forum_posts` — threaded community forum

> ⚠️ The `data/` directory is excluded from Git. Do not delete it during development.

---

## MySQL Database (FastAPI Backend)

**Database:** `careerbridge`  
**Schema:** [`mysql-schema.sql`](./mysql-schema.sql)  
**Created by:** SQLAlchemy's `Base.metadata.create_all()` on FastAPI startup

### Setup
```sql
CREATE DATABASE careerbridge
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### Tables (auto-created by SQLAlchemy)
- `users` — accounts with roles: student, alumni, tp_cell
- `student_profiles` — extended student profile data
- `alumni_profiles` — alumni employment and biography
- `skills` — shared skill catalog
- `student_skills` — M2M student-to-skill relationships
- `companies` — placement companies (drives)
- `company_criteria` — eligibility requirements per company
- `applications` — placement applications
- `resumes` — resume metadata (files in `backend/uploads/resumes/`)
- `certificates` — student certifications
- `roadmaps` — individual student preparation roadmaps
- `mentorship_requests` — student-alumni mentorship
- `announcements` — T&P cell notices

### Configuration
See `backend/.env` for `DATABASE_URL`. Format:
```
DATABASE_URL=mysql+pymysql://root:PASSWORD@localhost:3306/careerbridge
```

> ⚠️ Never run `DROP DATABASE`, `DROP TABLE`, `DELETE FROM`, or `TRUNCATE` on production data.

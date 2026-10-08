import 'dotenv/config'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export const dataDirectory = path.resolve(process.env.CAREER_COMPASS_DATA_DIR || 'data')
export const uploadDirectory = path.join(dataDirectory, 'uploads')

fs.mkdirSync(uploadDirectory, { recursive: true })

export const db = new Database(path.join(dataDirectory, 'career-compass.sqlite'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Student', 'T&P Officer', 'Alumni')),
    branch TEXT NOT NULL DEFAULT 'CSE',
    cgpa REAL NOT NULL DEFAULT 0,
    backlogs INTEGER NOT NULL DEFAULT 0,
    certifications INTEGER NOT NULL DEFAULT 0,
    skills_json TEXT NOT NULL DEFAULT '[]',
    company TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drives (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    salary REAL NOT NULL CHECK (salary > 0),
    min_cgpa REAL NOT NULL CHECK (min_cgpa >= 0 AND min_cgpa <= 10),
    max_backlogs INTEGER NOT NULL CHECK (max_backlogs >= 0),
    branches_json TEXT NOT NULL,
    skills_json TEXT NOT NULL,
    preferred_json TEXT NOT NULL DEFAULT '[]',
    keywords_json TEXT NOT NULL DEFAULT '[]',
    deadline TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resumes (
    student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    size_bytes INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    credential_id TEXT NOT NULL DEFAULT '',
    credential_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    stored_name TEXT NOT NULL DEFAULT '',
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    drive_id TEXT NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Under review' CHECK (status IN ('Under review', 'Shortlisted', 'Selected', 'Rejected')),
    match_score REAL NOT NULL,
    score_json TEXT NOT NULL,
    profile_snapshot_json TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (drive_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS mentorship_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Declined')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, alumni_id)
  );

  CREATE TABLE IF NOT EXISTS interview_slots (
    id TEXT PRIMARY KEY,
    alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'Video call',
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Booked', 'Cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interview_bookings (
    id TEXT PRIMARY KEY,
    slot_id TEXT NOT NULL UNIQUE REFERENCES interview_slots(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_id TEXT NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'In progress', 'Submitted', 'Declined')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (alumni_id, drive_id)
  );

  CREATE TABLE IF NOT EXISTS forum_posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES forum_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS drives_owner_idx ON drives(owner_id);
  CREATE INDEX IF NOT EXISTS certificates_student_idx ON certificates(student_id, issue_date DESC);
  CREATE INDEX IF NOT EXISTS applications_drive_idx ON applications(drive_id, applied_at);
  CREATE INDEX IF NOT EXISTS applications_student_idx ON applications(student_id, applied_at);
  CREATE INDEX IF NOT EXISTS forum_posts_parent_idx ON forum_posts(parent_id, created_at);
`)
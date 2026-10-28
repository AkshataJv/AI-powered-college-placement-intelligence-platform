import 'dotenv/config'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export const dataDirectory = path.resolve(process.env.CAREER_BRIDGE_DATA_DIR || process.env.CAREER_COMPASS_DATA_DIR || 'data')
export const uploadDirectory = path.join(dataDirectory, 'uploads')

fs.mkdirSync(uploadDirectory, { recursive: true })

// Connects to live database (or career-bridge.sqlite if renamed)
const sqliteFileName = fs.existsSync(path.join(dataDirectory, 'career-bridge.sqlite'))
  ? 'career-bridge.sqlite'
  : 'career-compass.sqlite'
export const db = new Database(path.join(dataDirectory, sqliteFileName))

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
    experience TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    passout_year INTEGER NOT NULL DEFAULT 0,
    linkedin_url TEXT NOT NULL DEFAULT '',
    sem_gpa_json TEXT NOT NULL DEFAULT '{}',
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

  CREATE TABLE IF NOT EXISTS scorecards (
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

  CREATE TABLE IF NOT EXISTS connection_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, alumni_id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    connection_request_id TEXT NOT NULL UNIQUE REFERENCES connection_requests(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, alumni_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resume_analysis (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parsed_text TEXT NOT NULL DEFAULT '',
    parsed_skills_json TEXT NOT NULL DEFAULT '[]',
    parsed_experience_json TEXT NOT NULL DEFAULT '[]',
    parsed_education_json TEXT NOT NULL DEFAULT '[]',
    word_count INTEGER NOT NULL DEFAULT 0,
    parsed_at TEXT NOT NULL DEFAULT (datetime('now')),
    source_stored_name TEXT NOT NULL DEFAULT '',
    UNIQUE (student_id)
  );

  CREATE TABLE IF NOT EXISTS ai_match_scores (
    id TEXT PRIMARY KEY,
    application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
    drive_id TEXT NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semantic_score REAL NOT NULL DEFAULT 0,
    skill_overlap_json TEXT NOT NULL DEFAULT '{}',
    explanation_json TEXT NOT NULL DEFAULT '{}',
    model_version TEXT NOT NULL DEFAULT 'v1',
    computed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (drive_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS placement_predictions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    probability REAL NOT NULL,
    top_factors_json TEXT NOT NULL DEFAULT '[]',
    model_version TEXT NOT NULL DEFAULT 'v1',
    computed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id)
  );

  CREATE TABLE IF NOT EXISTS resume_feedback (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_id TEXT REFERENCES drives(id) ON DELETE CASCADE,
    feedback_text TEXT NOT NULL DEFAULT '',
    missing_skills_json TEXT NOT NULL DEFAULT '[]',
    ats_score REAL NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS drives_owner_idx ON drives(owner_id);
  CREATE INDEX IF NOT EXISTS certificates_student_idx ON certificates(student_id, issue_date DESC);
  CREATE INDEX IF NOT EXISTS applications_drive_idx ON applications(drive_id, applied_at);
  CREATE INDEX IF NOT EXISTS applications_student_idx ON applications(student_id, applied_at);
  CREATE INDEX IF NOT EXISTS forum_posts_parent_idx ON forum_posts(parent_id, created_at);
  CREATE INDEX IF NOT EXISTS connection_requests_student_idx ON connection_requests(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS connection_requests_alumni_idx ON connection_requests(alumni_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS conversations_student_idx ON conversations(student_id);
  CREATE INDEX IF NOT EXISTS conversations_alumni_idx ON conversations(alumni_id);
  CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS resume_analysis_student_idx ON resume_analysis(student_id);
  CREATE INDEX IF NOT EXISTS ai_match_scores_drive_idx ON ai_match_scores(drive_id);
  CREATE INDEX IF NOT EXISTS ai_match_scores_student_idx ON ai_match_scores(student_id);
  CREATE INDEX IF NOT EXISTS placement_predictions_student_idx ON placement_predictions(student_id);
  CREATE INDEX IF NOT EXISTS resume_feedback_student_idx ON resume_feedback(student_id);
  CREATE INDEX IF NOT EXISTS resume_feedback_drive_idx ON resume_feedback(drive_id);
`)

try {
  db.exec("ALTER TABLE users ADD COLUMN sem_gpa_json TEXT NOT NULL DEFAULT '{}'")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN experience TEXT NOT NULL DEFAULT ''")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''")
} catch {
  // column already exists
}

try {
  db.exec('ALTER TABLE users ADD COLUMN passout_year INTEGER NOT NULL DEFAULT 0')
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN linkedin_url TEXT NOT NULL DEFAULT ''")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE drives ADD COLUMN academic_year TEXT NOT NULL DEFAULT ''")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE drives ADD COLUMN eligible_years_json TEXT NOT NULL DEFAULT '[\"Final Year\"]'")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN academic_year TEXT NOT NULL DEFAULT ''")
} catch {
  // column already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS historical_placements (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_identifier TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    salary REAL NOT NULL,
    academic_year TEXT NOT NULL,
    batch_year INTEGER NOT NULL,
    skills_json TEXT NOT NULL DEFAULT '[]',
    placed_date TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS historical_eligible_counts (
    id TEXT PRIMARY KEY,
    academic_year TEXT NOT NULL,
    branch TEXT NOT NULL,
    eligible_count INTEGER NOT NULL,
    total_students INTEGER NOT NULL,
    UNIQUE(academic_year, branch)
  );

  CREATE INDEX IF NOT EXISTS historical_placements_year_idx ON historical_placements(academic_year, branch);
  CREATE INDEX IF NOT EXISTS historical_placements_comp_idx ON historical_placements(company);
  CREATE INDEX IF NOT EXISTS historical_placements_batch_idx ON historical_placements(batch_year);

  CREATE TABLE IF NOT EXISTS preparation_roadmaps (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_role TEXT NOT NULL,
    target_company TEXT NOT NULL DEFAULT '',
    skill_area TEXT NOT NULL DEFAULT 'All-Round',
    duration TEXT NOT NULL DEFAULT '6 Months',
    academic_year TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    company_verified INTEGER NOT NULL DEFAULT 0,
    stages_json TEXT NOT NULL DEFAULT '[]',
    skill_gap_json TEXT NOT NULL DEFAULT '{}',
    recommendations_json TEXT NOT NULL DEFAULT '[]',
    progress_percent REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS preparation_roadmaps_student_idx ON preparation_roadmaps(student_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Placement Drive', 'Internship', 'Important Notice', 'Event', 'Workshop', 'Mentorship', 'General')),
    priority TEXT NOT NULL CHECK (priority IN ('Urgent', 'Important', 'General')),
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_role TEXT NOT NULL,
    author_name TEXT NOT NULL,
    target_audience_json TEXT NOT NULL DEFAULT '{}',
    linked_drive_id TEXT REFERENCES drives(id) ON DELETE SET NULL,
    attachment_original_name TEXT NOT NULL DEFAULT '',
    attachment_stored_name TEXT NOT NULL DEFAULT '',
    attachment_size_bytes INTEGER NOT NULL DEFAULT 0,
    external_link TEXT NOT NULL DEFAULT '',
    is_archived INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements(created_at DESC);
  CREATE INDEX IF NOT EXISTS announcements_author_idx ON announcements(author_id);
  CREATE INDEX IF NOT EXISTS announcements_drive_idx ON announcements(linked_drive_id);
  CREATE INDEX IF NOT EXISTS announcements_archived_idx ON announcements(is_archived, expires_at);

  CREATE TABLE IF NOT EXISTS announcement_reads (
    id TEXT PRIMARY KEY,
    announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(announcement_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS announcement_reads_user_idx ON announcement_reads(user_id);
  CREATE INDEX IF NOT EXISTS announcement_reads_announcement_idx ON announcement_reads(announcement_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    announcement_id TEXT REFERENCES announcements(id) ON DELETE CASCADE,
    linked_drive_id TEXT REFERENCES drives(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'announcement',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, is_read, created_at DESC);
  CREATE INDEX IF NOT EXISTS notifications_announcement_idx ON notifications(announcement_id);

  CREATE TABLE IF NOT EXISTS placement_readiness_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_score REAL NOT NULL,
    breakdown_json TEXT NOT NULL,
    factors_json TEXT NOT NULL,
    calculated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS readiness_history_student_idx ON placement_readiness_history(student_id, calculated_at DESC);

  CREATE TABLE IF NOT EXISTS student_coding_progress (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    problem_title TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'Practice Lab',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    status TEXT NOT NULL DEFAULT 'Solved' CHECK (status IN ('Attempted', 'Solved')),
    solved_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, topic, problem_title)
  );
  CREATE INDEX IF NOT EXISTS student_coding_student_idx ON student_coding_progress(student_id);
`)

try {
  db.exec("ALTER TABLE resume_feedback ADD COLUMN sections_json TEXT NOT NULL DEFAULT '[]'")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE resume_feedback ADD COLUMN bullet_suggestions_json TEXT NOT NULL DEFAULT '[]'")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE resume_feedback ADD COLUMN target_role TEXT NOT NULL DEFAULT 'Software Engineer'")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE resume_feedback ADD COLUMN formatting_notes_json TEXT NOT NULL DEFAULT '[]'")
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE preparation_roadmaps ADD COLUMN hours_per_week INTEGER NOT NULL DEFAULT 15")
} catch {
  // column already exists
}


import('./services/seedHistoricalData.js')
  .then((m) => m.seedHistoricalPlacementsIfEmpty())
  .catch((err) => console.error('[Analytics Seed Error]', err.message || err))

import('./services/seedNotices.js')
  .then((m) => m.seedNoticesIfEmpty())
  .catch((err) => console.error('[Notice Seed Error]', err.message || err))


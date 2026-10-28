-- =============================================================
-- CareerBridge AI — SQLite Schema (Node.js / Express Server)
-- Used by: server/db.js via better-sqlite3
-- Database file: data/career-bridge.sqlite
-- =============================================================

-- Users table: students, T&P officers, alumni
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

-- Placement drives created by T&P officers
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

-- Student resume metadata (file stored in data/uploads/)
CREATE TABLE IF NOT EXISTS resumes (
  student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Student all-semester scorecard PDF (file stored in data/uploads/)
CREATE TABLE IF NOT EXISTS scorecards (
  student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Student certifications
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

-- Student placement applications
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

-- Alumni mentorship requests from students
CREATE TABLE IF NOT EXISTS mentorship_requests (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, alumni_id)
);

-- Mock interview slots offered by alumni
CREATE TABLE IF NOT EXISTS interview_slots (
  id TEXT PRIMARY KEY,
  alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'Video call',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Booked', 'Cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Student bookings for interview slots
CREATE TABLE IF NOT EXISTS interview_bookings (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL UNIQUE REFERENCES interview_slots(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Alumni referrals for placement drives
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drive_id TEXT NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'In progress', 'Submitted', 'Declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (alumni_id, drive_id)
);

-- Community forum posts (threaded)
CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES forum_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Connection requests between students and alumni
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

-- Active 1-to-1 conversations between students and alumni with accepted connections
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  connection_request_id TEXT NOT NULL UNIQUE REFERENCES connection_requests(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alumni_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, alumni_id)
);

-- Private chat messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI Resume parsed text and structured sections
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

-- AI Semantic & Skill Match Scores for applications
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

-- AI Placement prediction probabilities & feature importance
CREATE TABLE IF NOT EXISTS placement_predictions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  probability REAL NOT NULL,
  top_factors_json TEXT NOT NULL DEFAULT '[]',
  model_version TEXT NOT NULL DEFAULT 'v1',
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id)
);

-- AI Resume feedback, ATS scores, and missing skill analysis
CREATE TABLE IF NOT EXISTS resume_feedback (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drive_id TEXT REFERENCES drives(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL DEFAULT '',
  missing_skills_json TEXT NOT NULL DEFAULT '[]',
  ats_score REAL NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for query performance
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


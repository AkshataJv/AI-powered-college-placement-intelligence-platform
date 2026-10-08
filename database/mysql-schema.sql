-- =============================================================
-- CareerCompass AI — MySQL Schema (FastAPI / Python Backend)
-- Used by: backend/app/ via SQLAlchemy ORM
-- Database: careercompass (MySQL 8.x)
-- Tables are created automatically by SQLAlchemy on startup
-- NEVER run DROP or TRUNCATE manually on production data
-- =============================================================

-- Create the database (run once in MySQL Workbench):
CREATE DATABASE IF NOT EXISTS careercompass
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE careercompass;

-- ─── Users ───────────────────────────────────────────────────
-- Roles: student | alumni | tp_cell
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role         VARCHAR(20) NOT NULL,
  created_at   DATETIME(6) NOT NULL,
  updated_at   DATETIME(6) NOT NULL,
  CONSTRAINT ck_users_role CHECK (role IN ('student', 'alumni', 'tp_cell'))
);

-- ─── Student Profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE,
  branch     VARCHAR(50),
  cgpa       FLOAT,
  backlogs   INT DEFAULT 0,
  phone      VARCHAR(20),
  linkedin   VARCHAR(255),
  github     VARCHAR(255),
  portfolio  VARCHAR(255),
  bio        TEXT,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Alumni Profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alumni_profiles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE,
  company       VARCHAR(255),
  job_title     VARCHAR(255),
  graduation_year INT,
  branch        VARCHAR(50),
  linkedin      VARCHAR(255),
  bio           TEXT,
  created_at    DATETIME(6) NOT NULL,
  updated_at    DATETIME(6) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Skills Catalog ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- ─── Student Skills (M2M) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_skills (
  student_id INT NOT NULL,
  skill_id   INT NOT NULL,
  PRIMARY KEY (student_id, skill_id),
  FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id)   REFERENCES skills(id) ON DELETE CASCADE
);

-- ─── Companies (Placement Drives) ────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  role        VARCHAR(255) NOT NULL,
  salary_lpa  FLOAT,
  location    VARCHAR(255),
  description TEXT,
  status      VARCHAR(20) DEFAULT 'Open',
  deadline    DATE,
  created_by  INT,
  created_at  DATETIME(6) NOT NULL,
  updated_at  DATETIME(6) NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Company Criteria ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_criteria (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  company_id   INT NOT NULL UNIQUE,
  min_cgpa     FLOAT DEFAULT 0,
  max_backlogs INT DEFAULT 0,
  branches     JSON,
  skills       JSON,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ─── Applications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  student_id INT NOT NULL,
  status     VARCHAR(30) DEFAULT 'Under review',
  applied_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_application (company_id, student_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Resumes ─────────────────────────────────────────────────
-- Files stored in backend/uploads/resumes/
CREATE TABLE IF NOT EXISTS resumes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  student_id    INT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL UNIQUE,
  size_bytes    BIGINT NOT NULL,
  uploaded_at   DATETIME(6) NOT NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Certificates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  student_id     INT NOT NULL,
  name           VARCHAR(255) NOT NULL,
  issuer         VARCHAR(255) NOT NULL,
  issue_date     DATE NOT NULL,
  credential_id  VARCHAR(255),
  credential_url VARCHAR(500),
  description    TEXT,
  file_name      VARCHAR(255),
  stored_name    VARCHAR(255),
  uploaded_at    DATETIME(6) NOT NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Roadmap ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmaps (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL UNIQUE,
  content    JSON,
  updated_at DATETIME(6) NOT NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Mentorship Requests ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentorship_requests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  alumni_id  INT NOT NULL,
  message    TEXT,
  status     VARCHAR(20) DEFAULT 'Pending',
  created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_mentorship (student_id, alumni_id),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (alumni_id)  REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Announcements ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  content    TEXT NOT NULL,
  created_by INT,
  created_at DATETIME(6) NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- NOTE: Tables are created automatically by SQLAlchemy (Base.metadata.create_all)
-- when FastAPI starts. This file is documentation only.

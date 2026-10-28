import { db } from '../server/db.js'
import bcrypt from 'bcryptjs'

const hash = bcrypt.hashSync('Password123', 8)

// 1. T&P Officer
const tpId = 'tp-officer-demo-id'
db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, branch)
  VALUES (?, 'Prof. Rajesh Sharma', 'tp@careerbridge.edu', ?, 'T&P Officer', 'CSE')
  ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = 'T&P Officer'
`).run(tpId, hash)
const tpUser = db.prepare('SELECT id FROM users WHERE email = ?').get('tp@careerbridge.edu')

// 2. Drive
const driveId = 'demo-ai-drive-1'
db.prepare(`
  INSERT INTO drives (id, owner_id, company, role, salary, min_cgpa, max_backlogs, branches_json, skills_json, preferred_json, keywords_json, deadline, description, status)
  VALUES (?, ?, 'AI Tech Labs', 'Machine Learning Engineer', 1400000, 7.5, 0, ?, ?, ?, ?, '2029-12-31', 'Machine Learning Engineer Drive', 'Open')
  ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id
`).run(
  driveId,
  tpUser.id,
  JSON.stringify(['CSE', 'IT']),
  JSON.stringify(['Python', 'Machine Learning']),
  JSON.stringify(['Docker', 'Kubernetes']),
  JSON.stringify(['Git', 'FastAPI'])
)

// 3. Students
const s1Id = 'stud-aarav-id'
db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json)
  VALUES (?, 'Aarav Mehta', 'aarav.mehta@kkwagh.edu.in', ?, 'Student', 'CSE', 8.9, 0, 2, ?)
  ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, skills_json = excluded.skills_json
`).run(s1Id, hash, JSON.stringify(['Python', 'ML', 'SQL']))
const s1 = db.prepare('SELECT id FROM users WHERE email = ?').get('aarav.mehta@kkwagh.edu.in')

const s2Id = 'stud-priya-id'
db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json)
  VALUES (?, 'Priya Sharma', 'priya.sharma@kkwagh.edu.in', ?, 'Student', 'IT', 8.2, 0, 1, ?)
  ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, skills_json = excluded.skills_json
`).run(s2Id, hash, JSON.stringify(['Java', 'Spring Boot']))
const s2 = db.prepare('SELECT id FROM users WHERE email = ?').get('priya.sharma@kkwagh.edu.in')

const s3Id = 'stud-rohan-id'
db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json)
  VALUES (?, 'Rohan Kulkarni', 'rohan.kulkarni@kkwagh.edu.in', ?, 'Student', 'CSE', 8.0, 0, 0, ?)
  ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, skills_json = excluded.skills_json
`).run(s3Id, hash, JSON.stringify(['C++', 'Data Structures']))
const s3 = db.prepare('SELECT id FROM users WHERE email = ?').get('rohan.kulkarni@kkwagh.edu.in')

// 4. Applications
db.prepare('DELETE FROM applications WHERE drive_id = ?').run(driveId)
db.prepare('DELETE FROM ai_match_scores WHERE drive_id = ?').run(driveId)

const app1Id = 'app-aarav-1'
db.prepare(`
  INSERT INTO applications (id, drive_id, student_id, match_score, score_json, profile_snapshot_json, status, applied_at)
  VALUES (?, ?, ?, 36.5, ?, '{}', 'Under review', datetime('now', '-2 days'))
`).run(app1Id, driveId, s1.id, JSON.stringify({
  score: 36.5, required: 25, requiredMatches: '1 of 2', preferred: 0, preferredMatches: '0 of 2', keywords: 0, keywordMatches: '0 of 2', completeness: 11.5
}))

const app2Id = 'app-priya-2'
db.prepare(`
  INSERT INTO applications (id, drive_id, student_id, match_score, score_json, profile_snapshot_json, status, applied_at)
  VALUES (?, ?, ?, 20.0, ?, '{}', 'Under review', datetime('now', '-1 days'))
`).run(app2Id, driveId, s2.id, JSON.stringify({
  score: 20.0, required: 0, requiredMatches: '0 of 2', preferred: 0, preferredMatches: '0 of 2', keywords: 0, keywordMatches: '0 of 2', completeness: 20.0
}))

const app3Id = 'app-rohan-3'
db.prepare(`
  INSERT INTO applications (id, drive_id, student_id, match_score, score_json, profile_snapshot_json, status, applied_at)
  VALUES (?, ?, ?, 45.0, ?, '{}', 'Under review', datetime('now'))
`).run(app3Id, driveId, s3.id, JSON.stringify({
  score: 45.0, required: 0, requiredMatches: '0 of 2', preferred: 0, preferredMatches: '0 of 2', keywords: 0, keywordMatches: '0 of 2', completeness: 45.0
}))

// 5. AI scores (Aarav = 80, Rohan = null)
db.prepare(`
  INSERT INTO ai_match_scores (id, application_id, drive_id, student_id, semantic_score, skill_overlap_json, explanation_json, model_version, computed_at)
  VALUES ('ai-score-1', ?, ?, ?, 80, ?, ?, 'v1', datetime('now'))
`).run(
  app1Id,
  driveId,
  s1.id,
  JSON.stringify({
    required: {
      matched: [
        { target_skill: 'Python', best_match: 'Python', similarity: 1.0 },
        { target_skill: 'Machine Learning', best_match: 'ML', similarity: 0.95 }
      ],
      missing: [],
      match_percentage: 100
    },
    preferred: {
      matched: [
        { target_skill: 'Docker', best_match: 'Docker', similarity: 1.0 }
      ],
      missing: [
        { target_skill: 'Kubernetes', closest_candidate: 'Docker', similarity: 0.42 }
      ],
      match_percentage: 50
    },
    keywords: {
      matched: [
        { target_skill: 'Git', best_match: 'Git', similarity: 1.0 }
      ],
      missing: [
        { target_skill: 'FastAPI', closest_candidate: 'Python', similarity: 0.48 }
      ],
      match_percentage: 50
    }
  }),
  JSON.stringify({
    text: 'Strong match: 2 of 2 required skills found (including Python, Machine Learning). 1 of 2 preferred skills matched (Docker). 1 of 2 relevant keywords matched (Git).'
  })
)

console.log('Seed demo data created successfully! Drive ID:', driveId)

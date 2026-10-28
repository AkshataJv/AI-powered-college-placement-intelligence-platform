import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '../server/db.js'

const NODE_BASE_URL = 'http://127.0.0.1:3001'
const jwtSecret = process.env.JWT_SECRET || 'career-bridge-local-development-secret-change-me'

// Helper to create test token
function createToken(userId) {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '1h' })
}

async function runTests() {
  console.log('--- Starting Resume Analysis Integration Verification ---')

  // Find or create student with resume
  const studentWithResume = db.prepare(`
    SELECT u.id, u.name, u.email, r.original_name, r.stored_name 
    FROM users u 
    JOIN resumes r ON u.id = r.student_id 
    WHERE u.role = 'Student' 
    LIMIT 1
  `).get()

  if (!studentWithResume) {
    throw new Error('Could not find a student with an uploaded resume in the database.')
  }
  console.log(`[Setup] Student with resume: ${studentWithResume.name} (${studentWithResume.email})`)
  const tokenWithResume = createToken(studentWithResume.id)

  // Find or create student without resume
  const tempStudentId = randomUUID()
  const tempEmail = `test-no-resume-${Date.now()}@example.com`
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json)
    VALUES (?, ?, ?, ?, 'Student', 'CSE', 8.5, 0, 0, '[]')
  `).run(tempStudentId, 'Temporary Test Student', tempEmail, bcrypt.hashSync('Password123', 8))
  console.log(`[Setup] Created temp student without resume: ${tempEmail} (${tempStudentId})`)
  const tokenWithoutResume = createToken(tempStudentId)

  try {
    // -------------------------------------------------------------------------
    // TEST 1: POST /api/student/resume/analyze for student with NO resume (expect 404)
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Testing POST /api/student/resume/analyze for student without resume...')
    const resNoResume = await fetch(`${NODE_BASE_URL}/api/student/resume/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenWithoutResume}`,
      },
    })
    const bodyNoResume = await resNoResume.json()
    console.log(`Status: ${resNoResume.status}`, bodyNoResume)
    if (resNoResume.status !== 404) {
      throw new Error(`Expected 404, got ${resNoResume.status}`)
    }
    if (!bodyNoResume.error?.includes('No resume uploaded yet')) {
      throw new Error(`Expected error message about no resume uploaded, got: ${JSON.stringify(bodyNoResume)}`)
    }
    console.log('✔ Test 1 Passed: 404 returned correctly when no resume uploaded.')

    // -------------------------------------------------------------------------
    // TEST 2: POST /api/student/resume/analyze for student WITH resume (expect 200)
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing POST /api/student/resume/analyze for student with resume...')
    const resAnalyze = await fetch(`${NODE_BASE_URL}/api/student/resume/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenWithResume}`,
      },
    })
    const bodyAnalyze = await resAnalyze.json()
    console.log(`Status: ${resAnalyze.status}`)
    if (resAnalyze.status !== 200) {
      throw new Error(`Expected 200 from POST /api/student/resume/analyze, got ${resAnalyze.status}: ${JSON.stringify(bodyAnalyze)}`)
    }
    console.log(`Parsed skills count: ${bodyAnalyze.skills?.length}`)
    console.log(`Sample skills: ${bodyAnalyze.skills?.slice(0, 10).join(', ')}`)
    console.log(`Word count: ${bodyAnalyze.wordCount || bodyAnalyze.word_count}`)
    console.log(`Education entries count: ${bodyAnalyze.education?.length}`)
    if (!bodyAnalyze.skills || bodyAnalyze.skills.length === 0) {
      throw new Error('Expected extracted skills, got empty list.')
    }
    console.log('✔ Test 2 Passed: Resume successfully parsed by AI service and saved by Node backend.')

    // -------------------------------------------------------------------------
    // TEST 3: GET /api/student/resume/analysis (expect 200 with saved data)
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing GET /api/student/resume/analysis...')
    const resGetAnalysis = await fetch(`${NODE_BASE_URL}/api/student/resume/analysis`, {
      headers: {
        Authorization: `Bearer ${tokenWithResume}`,
      },
    })
    const bodyGetAnalysis = await resGetAnalysis.json()
    console.log(`Status: ${resGetAnalysis.status}`)
    if (resGetAnalysis.status !== 200) {
      throw new Error(`Expected 200 from GET /api/student/resume/analysis, got ${resGetAnalysis.status}`)
    }
    if (!bodyGetAnalysis.skills || bodyGetAnalysis.skills.length !== bodyAnalyze.skills.length) {
      throw new Error('Saved analysis skills do not match analysis result.')
    }
    console.log(`Saved parsed_at: ${bodyGetAnalysis.parsedAt || bodyGetAnalysis.parsed_at}`)
    console.log('✔ Test 3 Passed: GET /api/student/resume/analysis returns saved analysis data.')

    // -------------------------------------------------------------------------
    // TEST 4: Existing routes still function normally
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing existing GET /api/student/resume and /api/student/resume/file...')
    const resResumeMeta = await fetch(`${NODE_BASE_URL}/api/student/resume`, {
      headers: { Authorization: `Bearer ${tokenWithResume}` },
    })
    console.log(`GET /api/student/resume Status: ${resResumeMeta.status}`)
    if (resResumeMeta.status !== 200) throw new Error('Existing GET /api/student/resume failed')

    const resResumeFile = await fetch(`${NODE_BASE_URL}/api/student/resume/file`, {
      headers: { Authorization: `Bearer ${tokenWithResume}` },
    })
    console.log(`GET /api/student/resume/file Status: ${resResumeFile.status}, Content-Type: ${resResumeFile.headers.get('content-type')}`)
    if (resResumeFile.status !== 200) throw new Error('Existing GET /api/student/resume/file failed')
    console.log('✔ Test 4 Passed: Existing resume routes work completely unaffected.')

  } finally {
    // Cleanup temporary student
    db.prepare('DELETE FROM users WHERE id = ?').run(tempStudentId)
    console.log('\n[Cleanup] Removed temporary test student.')
  }

  console.log('\n--- All Core Resume Analysis Integration Tests Passed Successfully ---')
}

runTests().catch((err) => {
  console.error('\n❌ Test Run Failed:', err)
  process.exit(1)
})

import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const NODE_BASE_URL = process.env.NODE_BASE_URL || 'http://127.0.0.1:3001'
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
const jwtSecret = process.env.JWT_SECRET || 'career-bridge-local-development-secret-change-me'

function createToken(userId, role = 'Student') {
  return jwt.sign({ sub: userId, role }, jwtSecret, { expiresIn: '1h' })
}

async function isHealthy(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForHealth(url, maxRetries = 25, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    if (await isHealthy(url)) return true
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return false
}

function killProcess(proc) {
  if (!proc || proc.killed) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'])
    } else {
      proc.kill('SIGTERM')
    }
  } catch {
    // Process might already be dead
  }
}

async function runTests() {
  console.log('--- Starting Semantic Matching Integration Verification ---')

  let spawnedNode = null
  let spawnedAi = null

  // Ensure Node server is running
  const nodeAlreadyUp = await isHealthy(`${NODE_BASE_URL}/api/health`)
  if (!nodeAlreadyUp) {
    console.log('[Setup] Starting Node server on port 3001...')
    spawnedNode = spawn('node', ['server/index.js'], {
      cwd: projectRoot,
      env: { ...process.env, API_PORT: '3001' },
      stdio: 'pipe',
    })
    spawnedNode.stderr.on('data', (d) => {
      const msg = d.toString().trim()
      if (msg) console.error(`[Node Server Log] ${msg}`)
    })
    const nodeReady = await waitForHealth(`${NODE_BASE_URL}/api/health`, 15, 1000)
    if (!nodeReady) {
      killProcess(spawnedNode)
      throw new Error('Failed to start Node server on port 3001.')
    }
    console.log('[Setup] Node server is ready.')
  } else {
    console.log('[Setup] Node server is already running.')
  }

  // Ensure AI microservice is running
  const aiAlreadyUp = await isHealthy(`${AI_SERVICE_URL}/health`)
  if (!aiAlreadyUp) {
    console.log('[Setup] Starting AI FastAPI microservice on port 8000...')
    const pythonExe = process.platform === 'win32'
      ? path.join(projectRoot, 'ai-service', 'venv', 'Scripts', 'python.exe')
      : path.join(projectRoot, 'ai-service', 'venv', 'bin', 'python')

    spawnedAi = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: path.join(projectRoot, 'ai-service'),
      stdio: 'pipe',
    })
    spawnedAi.stderr.on('data', (d) => {
      const msg = d.toString().trim()
      if (msg.includes('Started server process') || msg.includes('Uvicorn running') || msg.includes('loaded and ready')) {
        console.log(`[AI Service Log] ${msg}`)
      }
    })
    const aiReady = await waitForHealth(`${AI_SERVICE_URL}/health`, 30, 1000)
    if (!aiReady) {
      killProcess(spawnedAi)
      if (spawnedNode) killProcess(spawnedNode)
      throw new Error('Failed to start AI microservice on port 8000 within 30 seconds.')
    }
    console.log('[Setup] AI microservice is ready.')
  } else {
    console.log('[Setup] AI microservice is already running.')
  }

  // Track created records for cleanup
  const createdUserIds = []
  const createdDriveIds = []

  try {
    // 1. Create T&P Officer
    const tpId = randomUUID()
    const tpEmail = `tp-test-${Date.now()}@example.com`
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, branch)
      VALUES (?, ?, ?, ?, 'T&P Officer', 'CSE')
    `).run(tpId, 'Test T&P Officer', tpEmail, bcrypt.hashSync('Password123', 8))
    createdUserIds.push(tpId)
    const tpToken = createToken(tpId, 'T&P Officer')

    // 2. Create Student 1 with profile skills
    const student1Id = randomUUID()
    const student1Email = `student1-test-${Date.now()}@example.com`
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json, academic_year)
      VALUES (?, ?, ?, ?, 'Student', 'CSE', 8.9, 0, 2, ?, 'Final Year')
    `).run(student1Id, 'Semantic Candidate One', student1Email, bcrypt.hashSync('Password123', 8), JSON.stringify(['Python', 'ML', 'SQL']))
    createdUserIds.push(student1Id)
    const student1Token = createToken(student1Id, 'Student')

    // Add resume_analysis skills for student 1 to verify skill merging
    db.prepare(`
      INSERT INTO resume_analysis (id, student_id, parsed_text, parsed_skills_json, word_count, parsed_at)
      VALUES (?, ?, 'Sample resume text', ?, 120, datetime('now'))
    `).run(randomUUID(), student1Id, JSON.stringify(['Docker', 'Git']))

    // 3. Create Drive 1
    const drive1Id = randomUUID()
    db.prepare(`
      INSERT INTO drives (id, owner_id, company, role, salary, min_cgpa, max_backlogs, branches_json, skills_json, preferred_json, keywords_json, deadline, description)
      VALUES (?, ?, 'AI Tech Labs', 'Machine Learning Engineer', 1400000, 7.5, 0, ?, ?, ?, ?, '2029-12-31', 'Machine Learning Engineer Drive')
    `).run(
      drive1Id,
      tpId,
      JSON.stringify(['CSE', 'IT']),
      JSON.stringify(['Python', 'Machine Learning']),
      JSON.stringify(['Docker', 'Kubernetes']),
      JSON.stringify(['Git', 'FastAPI'])
    )
    createdDriveIds.push(drive1Id)

    // -------------------------------------------------------------------------
    // TEST 1: POST /api/drives/:id/apply creates ai_match_scores row
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Testing POST /api/drives/:id/apply with AI service running...')
    const applyRes = await fetch(`${NODE_BASE_URL}/api/drives/${drive1Id}/apply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    })
    const applyBody = await applyRes.json()
    console.log(`Apply status: ${applyRes.status}`, applyBody)
    if (applyRes.status !== 201) {
      throw new Error(`Expected 201 from apply endpoint, got ${applyRes.status}: ${JSON.stringify(applyBody)}`)
    }

    // Check ai_match_scores table in SQLite
    const matchRow = db.prepare('SELECT * FROM ai_match_scores WHERE drive_id = ? AND student_id = ?').get(drive1Id, student1Id)
    if (!matchRow) {
      throw new Error('Expected an ai_match_scores row in the database, but none was found.')
    }
    console.log('Database ai_match_scores row found:', {
      semantic_score: matchRow.semantic_score,
      skill_overlap: JSON.parse(matchRow.skill_overlap_json),
      explanation: JSON.parse(matchRow.explanation_json),
    })

    if (typeof matchRow.semantic_score !== 'number' || matchRow.semantic_score <= 0) {
      throw new Error(`Expected semantic_score > 0, got ${matchRow.semantic_score}`)
    }

    const overlap = JSON.parse(matchRow.skill_overlap_json)
    if (!overlap.required || !Array.isArray(overlap.required.matched)) {
      throw new Error('Expected skill_overlap_json to include required.matched array.')
    }
    const matchedNames = overlap.required.matched.map((m) => m.target_skill)
    if (!matchedNames.includes('Python') && !matchedNames.includes('Machine Learning')) {
      throw new Error(`Expected 'Python' or 'Machine Learning' in matched skills, got: ${JSON.stringify(matchedNames)}`)
    }
    console.log('✔ Test 1 Passed: Applying to a drive creates an ai_match_scores row with semantic matching breakdown.')

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/tp/drives/:id/applicants includes AI score fields
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing GET /api/tp/drives/:id/applicants returns AI score fields...')
    const applicantsRes = await fetch(`${NODE_BASE_URL}/api/tp/drives/${drive1Id}/applicants`, {
      headers: {
        Authorization: `Bearer ${tpToken}`,
      },
    })
    const applicantsBody = await applicantsRes.json()
    console.log(`Applicants status: ${applicantsRes.status}`)
    if (applicantsRes.status !== 200) {
      throw new Error(`Expected 200 from applicants endpoint, got ${applicantsRes.status}: ${JSON.stringify(applicantsBody)}`)
    }

    const applicant1 = applicantsBody.applicants?.find((a) => a.studentId === student1Id)
    if (!applicant1) {
      throw new Error(`Candidate ${student1Id} not found in applicants response.`)
    }

    console.log('Applicant AI fields returned:', {
      aiSemanticScore: applicant1.aiSemanticScore,
      aiExplanation: applicant1.aiExplanation,
      aiSkillBreakdown: applicant1.aiSkillBreakdown ? 'Present (object)' : applicant1.aiSkillBreakdown,
    })

    if (typeof applicant1.aiSemanticScore !== 'number' || applicant1.aiSemanticScore <= 0) {
      throw new Error(`Expected aiSemanticScore > 0, got ${applicant1.aiSemanticScore}`)
    }
    if (typeof applicant1.aiExplanation !== 'string' || !applicant1.aiExplanation.trim()) {
      throw new Error(`Expected aiExplanation to be a non-empty string, got: ${applicant1.aiExplanation}`)
    }
    if (!applicant1.aiSkillBreakdown || typeof applicant1.aiSkillBreakdown !== 'object') {
      throw new Error('Expected aiSkillBreakdown to be an object.')
    }
    console.log('✔ Test 2 Passed: Applicants list correctly includes aiSemanticScore, aiExplanation, and aiSkillBreakdown.')

    // -------------------------------------------------------------------------
    // TEST 3: POST /api/tp/drives/:id/recompute-ai-scores batch recalculation
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing POST /api/tp/drives/:id/recompute-ai-scores batch recalculation...')
    // Add Student 2 to test multi-candidate batching
    const student2Id = randomUUID()
    const student2Email = `student2-test-${Date.now()}@example.com`
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json, academic_year)
      VALUES (?, ?, ?, ?, 'Student', 'CSE', 8.2, 0, 1, ?, 'Final Year')
    `).run(student2Id, 'Candidate Two', student2Email, bcrypt.hashSync('Password123', 8), JSON.stringify(['Java', 'Spring Boot']))
    createdUserIds.push(student2Id)
    const student2Token = createToken(student2Id, 'Student')

    // Apply Student 2
    const apply2Res = await fetch(`${NODE_BASE_URL}/api/drives/${drive1Id}/apply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student2Token}` },
    })
    if (apply2Res.status !== 201) {
      throw new Error(`Failed to apply student 2: ${apply2Res.status}`)
    }

    // Call recompute endpoint
    const recomputeRes = await fetch(`${NODE_BASE_URL}/api/tp/drives/${drive1Id}/recompute-ai-scores`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tpToken}` },
    })
    const recomputeBody = await recomputeRes.json()
    console.log(`Recompute status: ${recomputeRes.status}`, recomputeBody)

    if (recomputeRes.status !== 200) {
      throw new Error(`Expected 200 from recompute endpoint, got ${recomputeRes.status}: ${JSON.stringify(recomputeBody)}`)
    }
    if (recomputeBody.updated !== 2) {
      throw new Error(`Expected updated: 2, got ${recomputeBody.updated}`)
    }
    if (!Array.isArray(recomputeBody.results) || recomputeBody.results.length !== 2) {
      throw new Error(`Expected results array of length 2, got ${recomputeBody.results?.length}`)
    }

    // Results should be sorted descending by semantic_score
    const [topResult, lowerResult] = recomputeBody.results
    if (topResult.semantic_score < lowerResult.semantic_score) {
      throw new Error('Expected results to be sorted descending by semantic_score.')
    }
    console.log(`Top candidate score: ${topResult.student_id} (${topResult.semantic_score}), Second candidate score: ${lowerResult.student_id} (${lowerResult.semantic_score})`)
    console.log('✔ Test 3 Passed: POST /api/tp/drives/:id/recompute-ai-scores successfully recomputed scores for all applicants.')

    // -------------------------------------------------------------------------
    // TEST 4: Applying still succeeds when the AI service is stopped
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing applying to a drive when AI service is stopped...')
    // Shut down AI service
    if (spawnedAi) {
      killProcess(spawnedAi)
      spawnedAi = null
    } else {
      // Find and kill whatever is on port 8000
      try {
        if (process.platform === 'win32') {
          spawn('powershell', ['-Command', 'Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }'])
        }
      } catch {
        // Ignore
      }
    }

    // Wait until AI service is confirmed down
    let aiDown = false
    for (let i = 0; i < 10; i++) {
      if (!(await isHealthy(`${AI_SERVICE_URL}/health`))) {
        aiDown = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    console.log(`AI service offline confirmed: ${aiDown}`)

    // Create Drive 2
    const drive2Id = randomUUID()
    db.prepare(`
      INSERT INTO drives (id, owner_id, company, role, salary, min_cgpa, max_backlogs, branches_json, skills_json, preferred_json, keywords_json, deadline, description)
      VALUES (?, ?, 'Offline AI Corp', 'Data Analyst', 900000, 7.0, 0, ?, ?, '[]', '[]', '2029-12-31', 'Test Offline Drive')
    `).run(drive2Id, tpId, JSON.stringify(['CSE', 'IT']), JSON.stringify(['SQL', 'Excel']))
    createdDriveIds.push(drive2Id)

    // Student 1 applies to Drive 2 while AI service is stopped
    const applyOfflineRes = await fetch(`${NODE_BASE_URL}/api/drives/${drive2Id}/apply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
    })
    const applyOfflineBody = await applyOfflineRes.json()
    console.log(`Apply with AI offline status: ${applyOfflineRes.status}`, applyOfflineBody)

    if (applyOfflineRes.status !== 201) {
      throw new Error(`Expected 201 even when AI service is stopped, got ${applyOfflineRes.status}: ${JSON.stringify(applyOfflineBody)}`)
    }

    // Verify application was saved
    const appRow = db.prepare('SELECT * FROM applications WHERE drive_id = ? AND student_id = ?').get(drive2Id, student1Id)
    if (!appRow) {
      throw new Error('Application was not saved in SQLite database.')
    }

    // Verify no ai_match_scores row was created
    const aiRowOffline = db.prepare('SELECT * FROM ai_match_scores WHERE drive_id = ? AND student_id = ?').get(drive2Id, student1Id)
    if (aiRowOffline) {
      throw new Error('Unexpected ai_match_scores row found when AI service was stopped.')
    }

    // Verify applicants list returns nulls for AI fields
    const applicantsOfflineRes = await fetch(`${NODE_BASE_URL}/api/tp/drives/${drive2Id}/applicants`, {
      headers: { Authorization: `Bearer ${tpToken}` },
    })
    const applicantsOfflineBody = await applicantsOfflineRes.json()
    const offlineApplicant = applicantsOfflineBody.applicants?.find((a) => a.studentId === student1Id)
    if (!offlineApplicant) {
      throw new Error('Applicant not found in applicants list for drive 2.')
    }

    console.log('Applicant AI fields when AI service was offline:', {
      aiSemanticScore: offlineApplicant.aiSemanticScore,
      aiExplanation: offlineApplicant.aiExplanation,
      aiSkillBreakdown: offlineApplicant.aiSkillBreakdown,
    })

    if (offlineApplicant.aiSemanticScore !== null || offlineApplicant.aiExplanation !== null || offlineApplicant.aiSkillBreakdown !== null) {
      throw new Error('Expected all AI fields to be null when no ai_match_scores row exists.')
    }
    console.log('✔ Test 4 Passed: Applying succeeds with 201 when AI service is stopped, and AI fields return null.')

  } finally {
    // Cleanup created records
    console.log('\n[Cleanup] Cleaning up test records from database...')
    for (const driveId of createdDriveIds) {
      try {
        db.prepare('DELETE FROM applications WHERE drive_id = ?').run(driveId)
        db.prepare('DELETE FROM ai_match_scores WHERE drive_id = ?').run(driveId)
        db.prepare('DELETE FROM drives WHERE id = ?').run(driveId)
      } catch (err) {
        console.error(`[Cleanup] Error cleaning drive ${driveId}:`, err.message)
      }
    }
    for (const userId of createdUserIds) {
      try {
        db.prepare('DELETE FROM resume_analysis WHERE student_id = ?').run(userId)
        db.prepare('DELETE FROM users WHERE id = ?').run(userId)
      } catch (err) {
        console.error(`[Cleanup] Error cleaning user ${userId}:`, err.message)
      }
    }
    console.log('[Cleanup] Test database records removed successfully.')

    if (spawnedAi) {
      killProcess(spawnedAi)
    }
    if (spawnedNode) {
      killProcess(spawnedNode)
    }
  }

  console.log('\n--- All Semantic Matching Integration Tests Passed Successfully ---')
}

runTests().catch((err) => {
  console.error('\n❌ Test Run Failed:', err)
  process.exit(1)
})

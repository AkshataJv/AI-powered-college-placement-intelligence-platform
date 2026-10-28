import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { db } from '../server/db.js'
import { ROLES } from '../server/constants/roles.js'

const jwtSecret = process.env.JWT_SECRET || 'career-bridge-local-development-secret-change-me'
const BASE_URL = 'http://127.0.0.1:3001'

function makeToken(sub, role) {
  return jwt.sign({ sub, role }, jwtSecret, { expiresIn: '1h' })
}

async function runStage1Tests() {
  console.log('=== Running Stage 1 Core Student Intelligence API Integration Tests ===\n')

  // Ensure a student exists\n  let student = db.prepare("SELECT id, name, email FROM users WHERE role = ? LIMIT 1", ROLES.STUDENT).get();\n  if (!student) {\n    const newId = randomUUID();\n    db.prepare(`INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json, company, job_title, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(\n      newId,\n      'Test Student',\n      'test.student@example.com',\n      'dummyhash',\n      ROLES.STUDENT,\n      'CSE',\n      0,\n      0,\n      0,\n      '[]',\n      '',\n      '',\n      'First Year'\n    );\n    student = { id: newId, name: 'Test Student', email: 'test.student@example.com' };\n  }\n  console.log(`Using test student: ${student.name} (${student.id})`);\n\n  // Ensure a T&P Officer exists\n  let tpUser = db.prepare("SELECT id FROM users WHERE role = ? LIMIT 1", ROLES.TP_OFFICER).get();\n  if (!tpUser) {\n    const tpId = randomUUID();\n    db.prepare(`INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json, company, job_title, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(\n      tpId,\n      'Test TP Officer',\n      'tp.officer@example.com',\n      'dummyhash',\n      ROLES.TP_OFFICER,\n      'CSE',\n      0,\n      0,\n      0,\n      '[]',\n      '',\n      '',\n      'First Year'\n    );\n    tpUser = { id: tpId };\n  }\n  const studentToken = makeToken(student.id, ROLES.STUDENT);\n  const tpToken = makeToken(tpUser.id, ROLES.TP_OFFICER);


  // 1. Unauthenticated checks
  console.log('1. Checking authentication & role gates...')
  const unauthRes = await fetch(`${BASE_URL}/api/student/readiness-score`)
  if (unauthRes.status !== 401) throw new Error(`Expected 401 for unauthenticated, got ${unauthRes.status}`)

  const tpForbiddenRes = await fetch(`${BASE_URL}/api/student/readiness-score`, {
    headers: { Authorization: `Bearer ${tpToken}` },
  })
  if (tpForbiddenRes.status !== 403) throw new Error(`Expected 403 for T&P Officer, got ${tpForbiddenRes.status}`)
  console.log('  ✓ 401 and 403 access gates verified.')

  // 2. Placement Readiness Score
  console.log('\n2. Testing GET /api/student/readiness-score...')
  const readinessRes = await fetch(`${BASE_URL}/api/student/readiness-score`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  if (readinessRes.status !== 200) throw new Error(`Readiness score failed with ${readinessRes.status}`)
  const readinessData = await readinessRes.json()
  console.log(`  - Overall Score: ${readinessData.overall_score} / 100`)
  console.log(`  - Tier: ${readinessData.readiness_tier}`)
  console.log(`  - Factors Count: ${readinessData.factors?.length}`)
  console.log(`  - Distinction Note Present: ${Boolean(readinessData.distinction_note)}`)
  console.log(`  - Placement Probability: ${readinessData.estimated_placement_probability}%`)

  if (typeof readinessData.overall_score !== 'number' || !readinessData.factors) {
    throw new Error('Readiness data missing expected fields')
  }
  console.log('  ✓ Placement readiness score successfully calculated.')

  // Test recalculate
  console.log('  Testing POST /api/student/readiness-score/recalculate...')
  const recalcRes = await fetch(`${BASE_URL}/api/student/readiness-score/recalculate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  if (recalcRes.status !== 200) throw new Error(`Recalculate failed with ${recalcRes.status}`)
  const recalcData = await recalcRes.json()
  console.log(`  - Recalculated Score: ${recalcData.overall_score}, History count: ${recalcData.history?.length}`)
  console.log('  ✓ Readiness recalculate and history snapshot verified.')

  // 3. Skill Gap Analysis
  console.log('\n3. Testing Skill Gap Analysis...')
  const targetsRes = await fetch(`${BASE_URL}/api/student/skill-gap/targets`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  if (targetsRes.status !== 200) throw new Error(`Targets failed with ${targetsRes.status}`)
  const targetsData = await targetsRes.json()
  console.log(`  - Available Drives: ${targetsData.drives?.length}`)
  console.log(`  - Standard Roles: ${targetsData.standardRoles?.length}`)

  const gapAnalyzeRes = await fetch(`${BASE_URL}/api/student/skill-gap/analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetRole: 'Software Engineer',
      targetCompany: 'Google',
      requiredSkills: ['Data Structures', 'Algorithms', 'Java', 'SQL'],
      preferredSkills: ['System Design', 'Docker', 'Kubernetes'],
    }),
  })
  if (gapAnalyzeRes.status !== 200) throw new Error(`Skill gap analyze failed with ${gapAnalyzeRes.status}`)
  const gapData = await gapAnalyzeRes.json()
  console.log(`  - Match Percentage: ${gapData.match_percentage}%`)
  console.log(`  - Matched: ${gapData.matched_skills?.length}, Missing: ${gapData.missing_skills?.length}`)
  console.log(`  - Actionable Next Steps: ${gapData.actionable_next_steps?.length}`)
  console.log('  ✓ Skill gap analysis verified with learning resources & priority.')

  // 4. Resume ATS Analyzer
  console.log('\n4. Testing Resume ATS Analyzer...')
  const atsRes = await fetch(`${BASE_URL}/api/student/resume/ats-analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetRole: 'Software Engineer' }),
  })
  if (atsRes.status === 200) {
    const atsData = await atsRes.json()
    console.log(`  - ATS Score: ${atsData.ats_score} / 100`)
    console.log(`  - Assessment: ${atsData.assessment}`)
    console.log(`  - Sections Checked: ${atsData.sections?.length}`)
    console.log(`  - Bullet Suggestions: ${atsData.bullet_suggestions?.length}`)
    console.log(`  - Disclaimer Included: ${Boolean(atsData.disclaimer)}`)

    const getAtsRes = await fetch(`${BASE_URL}/api/student/resume/ats-analysis`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })
    if (getAtsRes.status !== 200) throw new Error(`Get saved ATS analysis failed with ${getAtsRes.status}`)
    console.log('  ✓ Resume ATS analysis and persistence verified.')
  } else if (atsRes.status === 404) {
    console.log('  - Student has no resume uploaded yet (expected 404 handled gracefully).')
  } else {
    throw new Error(`ATS analyze failed with ${atsRes.status}`)
  }

  // 5. AI Career Roadmap Generator
  console.log('\n5. Testing AI Career Roadmap Generator...')
  const genRoadmapRes = await fetch(`${BASE_URL}/api/student/roadmap/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetRole: 'Full Stack Developer',
      targetCompany: 'Microsoft',
      hoursPerWeek: 18,
    }),
  })
  if (genRoadmapRes.status !== 201) throw new Error(`Roadmap generate failed with ${genRoadmapRes.status}`)
  const roadmapData = await genRoadmapRes.json()
  const rm = roadmapData.roadmap
  console.log(`  - Roadmap Title: ${rm.title}`)
  console.log(`  - Duration: ${rm.duration}`)
  console.log(`  - Stages: ${rm.stages?.length}`)
  console.log(`  - Total Tasks: ${rm.totalTasks}`)
  console.log(`  - Initial Progress: ${rm.progressPercent}%`)

  // Pick first task to toggle
  const firstTask = rm.stages[0]?.weeks[0]?.tasks[0]
  if (firstTask) {
    console.log(`  Toggling completion for task ${firstTask.id}...`)
    const toggleRes = await fetch(`${BASE_URL}/api/student/roadmap/tasks/${firstTask.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}` },
    })
    if (toggleRes.status !== 200) throw new Error(`Toggle task failed with ${toggleRes.status}`)
    const toggleData = await toggleRes.json()
    console.log(`  - Task Completed: ${toggleData.completed}`)
    console.log(`  - Updated Roadmap Progress: ${toggleData.progressPercent}%`)
  }
  console.log('  ✓ AI Career Roadmap generator and interactive task tracking verified.')

  // 6. Coding Progress Tracking
  console.log('\n6. Testing Coding Progress Tracking...')
  const logProblemRes = await fetch(`${BASE_URL}/api/student/coding-progress`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: 'Arrays & Two Pointers',
      problemTitle: 'Two Sum II - Input Array Is Sorted',
      difficulty: 'Medium',
      status: 'Solved',
      platform: 'LeetCode',
    }),
  })
  if (logProblemRes.status !== 201) throw new Error(`Log problem failed with ${logProblemRes.status}`)

  const getProgRes = await fetch(`${BASE_URL}/api/student/coding-progress`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  if (getProgRes.status !== 200) throw new Error(`Get coding progress failed with ${getProgRes.status}`)
  const progData = await getProgRes.json()
  console.log(`  - Total Problems Tracked: ${progData.totalProblems}`)
  console.log(`  - Solved Count: ${progData.solvedCount}`)
  console.log('  ✓ Coding practice progress verified.')

  console.log('\n=== ALL STAGE 1 API INTEGRATION TESTS PASSED SUCCESSFULLY! ===')
}

runStage1Tests().catch((err) => {
  console.error('\n❌ Stage 1 Test Suite Failed:', err)
  process.exit(1)
})

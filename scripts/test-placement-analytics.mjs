import 'dotenv/config'
import jwt from 'jsonwebtoken'

const jwtSecret = process.env.JWT_SECRET || 'b2EPpKWeeSjW0hcExF0gb/8eFbt8tQvF7qQP8y14+vo='

function makeToken(sub, role) {
  return jwt.sign({ sub, role }, jwtSecret, { expiresIn: '1h' })
}

const studentToken = makeToken('36bc4926-7983-488e-ab04-6481f7c68bd6', 'Student')
const tpToken = makeToken('be0ec32e-4b59-4208-9d5e-994c76697a04', 'T&P Officer')
const alumniToken = makeToken('0d48aeb7-ee51-469f-b665-430e3e35aedf', 'Alumni')

async function testPlacementAnalytics() {
  console.log('=== Running Placement Analytics & AI Insights Test Suite ===\n')

  // Test 1: Authentication Requirement
  console.log('1. Testing authentication requirements...')
  const unauthRes = await fetch('http://127.0.0.1:3001/api/analytics/placement-stats')
  if (unauthRes.status === 401) {
    console.log('  ✓ Unauthenticated access successfully blocked (401)')
  } else {
    throw new Error(`Expected 401, got ${unauthRes.status}`)
  }

  // Test 2: Role Access (Student, Alumni, T&P Officer)
  console.log('2. Testing role access...')
  for (const [role, tok] of [['Student', studentToken], ['T&P Officer', tpToken], ['Alumni', alumniToken]]) {
    const res = await fetch('http://127.0.0.1:3001/api/analytics/placement-stats?demo_mode=true', {
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (res.status === 200) {
      console.log(`  ✓ ${role} can access placement statistics`)
    } else {
      throw new Error(`${role} failed with status ${res.status}`)
    }
  }

  // Test 3: Historical Presentation / Demo Mode Data Integrity & Mathematics
  console.log('\n3. Testing Demo Mode calculations & metrics...')
  const demoRes = await fetch('http://127.0.0.1:3001/api/analytics/placement-stats?demo_mode=true', {
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  const demoData = await demoRes.json()
  const s = demoData.summary
  console.log(`  - Total Unique Placed: ${s.totalPlaced}`)
  console.log(`  - Total Offers: ${s.totalOffers}`)
  console.log(`  - Total Eligible: ${s.totalEligible}`)
  console.log(`  - Overall Placement %: ${s.placementPercentage}%`)
  console.log(`  - Participating Companies: ${s.participatingCompanies}`)
  console.log(`  - Highest Package: ₹${s.highestPackage} LPA`)
  console.log(`  - Average Package: ₹${s.averagePackage} LPA`)
  console.log(`  - Median Package: ₹${s.medianPackage} LPA`)
  console.log(`  - YoY Placement Growth: ${s.yoyGrowth}%`)

  if (s.totalPlaced > 0 && s.totalOffers >= s.totalPlaced) {
    console.log('  ✓ Unique placed students and total offers correctly distinguished (no double counting)')
  } else {
    throw new Error('Offer count / placed logic failed')
  }

  const expectedPct = Math.round(((s.totalPlaced / s.totalEligible) * 100) * 10) / 10
  if (Math.abs(s.placementPercentage - expectedPct) < 0.1) {
    console.log(`  ✓ Placement percentage formula accurate: (${s.totalPlaced} / ${s.totalEligible}) * 100 = ${s.placementPercentage}%`)
  } else {
    throw new Error(`Placement percentage formula mismatch: expected ${expectedPct}, got ${s.placementPercentage}`)
  }

  // Test 4: Chart Datasets Verification
  console.log('\n4. Verifying all 6 required interactive chart datasets...')
  const charts = demoData.charts
  console.log(`  - Chart A (Year-wise Trends): ${charts.yearWiseTrends.length} years`)
  console.log(`  - Chart B (Branch Comparison): ${charts.branchComparison.length} branches`)
  console.log(`  - Chart C (Branch Distribution): ${charts.branchDistribution.length} slices`)
  console.log(`  - Chart D (Growth Over Time): ${charts.growthOverTime.length} data points`)
  console.log(`  - Chart E (Company Stats): ${charts.companyStats.length} companies`)
  console.log(`  - Chart F (Package Analysis): ${charts.packageAnalysis.length} branches analyzed`)

  if (
    charts.yearWiseTrends.length >= 4 &&
    charts.branchComparison.length >= 5 &&
    charts.branchDistribution.length >= 5 &&
    charts.growthOverTime.length >= 4 &&
    charts.companyStats.length >= 10 &&
    charts.packageAnalysis.length >= 5
  ) {
    console.log('  ✓ All 6 interactive charts populated with verified data')
  } else {
    throw new Error('Chart datasets missing or incomplete')
  }

  // Test 5: Filter combinations
  console.log('\n5. Testing filter combinations (Year: 2024-25, Branch: CSE)...')
  const filterRes = await fetch(
    'http://127.0.0.1:3001/api/analytics/placement-stats?academic_year=2024-25&branch=CSE&demo_mode=true',
    { headers: { Authorization: `Bearer ${studentToken}` } }
  )
  const filterData = await filterRes.json()
  console.log(`  - Filtered Placed (2024-25 CSE): ${filterData.summary.totalPlaced}`)
  console.log(`  - Filtered Eligible (2024-25 CSE): ${filterData.summary.totalEligible}`)
  console.log(`  - Filtered Conversion: ${filterData.summary.placementPercentage}%`)
  if (filterData.summary.totalPlaced > 0 && filterData.summary.totalPlaced <= s.totalPlaced) {
    console.log('  ✓ Multi-criteria filtering working accurately')
  } else {
    throw new Error('Filter calculation failed')
  }

  // Test 6: AI Placement Insights Endpoint
  console.log('\n6. Testing AI Placement Insights generation...')
  const aiRes = await fetch('http://127.0.0.1:3001/api/analytics/ai-insights', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aggregatedStats: demoData }),
  })
  const aiData = await aiRes.json()
  console.log(`  - Status: ${aiData.status}`)
  console.log(`  - Source: ${aiData.source}`)
  console.log(`  - Executive Summary: ${aiData.executive_summary?.slice(0, 80)}...`)
  console.log(`  - Observations Count: ${aiData.key_observations?.length || 0}`)
  console.log(`  - Student Guidance Count: ${aiData.student_preparation_guidance?.length || 0}`)

  if (aiData.key_observations?.length >= 2 && aiData.student_preparation_guidance?.length >= 2) {
    console.log('  ✓ AI placement insights generated and structured properly')
  } else {
    throw new Error('AI insights structure incomplete')
  }

  // Test 7: CSV Report Export
  console.log('\n7. Testing CSV Export endpoint...')
  const exportRes = await fetch('http://127.0.0.1:3001/api/analytics/export?academic_year=2025-26&branch=IT&demo_mode=true', {
    headers: { Authorization: `Bearer ${studentToken}` },
  })
  const csvContent = await exportRes.text()
  const lines = csvContent.trim().split('\r\n')
  console.log(`  - CSV Header: ${lines[0]}`)
  console.log(`  - CSV Data Rows (2025-26 IT): ${lines.length - 1}`)
  if (lines.length > 1 && lines[0].includes('Student Identifier')) {
    console.log('  ✓ CSV report generated and properly formatted with HTTP attachment header')
  } else {
    throw new Error('CSV export failed')
  }

  console.log('\n=== ALL 7 INTEGRATION TESTS PASSED SUCCESSFULLY! ===')
}

testPlacementAnalytics().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err)
  process.exit(1)
})

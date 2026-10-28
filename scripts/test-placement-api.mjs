import 'dotenv/config'
import jwt from 'jsonwebtoken'
const jwtSecret = process.env.JWT_SECRET || 'b2EPpKWeeSjW0hcExF0gb/8eFbt8tQvF7qQP8y14+vo='
const token = jwt.sign(
  { sub: '36bc4926-7983-488e-ab04-6481f7c68bd6', role: 'Student' },
  jwtSecret,
  { expiresIn: '1h' }
)

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
}

async function run() {
  console.log('Testing GET /api/analytics/placement-stats...')
  const statsRes = await fetch('http://127.0.0.1:3001/api/analytics/placement-stats?demo_mode=true', { headers })
  const statsData = await statsRes.json()
  console.log('Stats response success:', statsData.success)
  console.log('Summary:', statsData.summary)
  console.log('Available years:', statsData.filters.availableYears)
  console.log('Charts keys:', Object.keys(statsData.charts))
  console.log('Year trends count:', statsData.charts.yearWiseTrends.length)
  console.log('Branch comparison count:', statsData.charts.branchComparison.length)

  console.log('\nTesting POST /api/analytics/ai-insights...')
  const insightsRes = await fetch('http://127.0.0.1:3001/api/analytics/ai-insights', {
    method: 'POST',
    headers,
    body: JSON.stringify({ aggregatedStats: statsData }),
  })
  const insightsData = await insightsRes.json()
  console.log('Insights success:', insightsData.success)
  console.log('Executive summary:', insightsData.executive_summary)
  console.log('Key observations:', insightsData.key_observations)
  console.log('Student guidance:', insightsData.student_preparation_guidance)
  console.log('Source:', insightsData.source)

  console.log('\nTesting GET /api/analytics/export...')
  const exportRes = await fetch('http://127.0.0.1:3001/api/analytics/export?demo_mode=true', { headers })
  const csvText = await exportRes.text()
  const csvLines = csvText.trim().split('\n')
  console.log('Export CSV header:', csvLines[0])
  console.log('Total CSV rows:', csvLines.length)
  console.log('Sample row:', csvLines[1])
}

run().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})

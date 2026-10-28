import { db } from '../db.js'

function parseJson(value, fallback = []) {
  try {
    return JSON.parse(value || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function normalizeSalaryToLpa(sal) {
  const num = Number(sal) || 0
  if (num <= 0) return 0
  if (num >= 100000) {
    return Math.round((num / 100000) * 10) / 10
  }
  return Math.round(num * 10) / 10
}

function computeMedian(arr) {
  if (!arr || arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 !== 0) {
    return Math.round(sorted[mid] * 10) / 10
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
}

export function getPlacementAnalytics({
  academicYear = 'All',
  branch = 'All',
  company = 'All',
  batch = 'All',
  demoMode = true,
}) {
  const isDemo = String(demoMode) === 'true' || demoMode === true

  let allPlacementRows = []
  let allEligibleRows = []

  if (isDemo) {
    allPlacementRows = db.prepare(`
      SELECT 
        id,
        student_name,
        student_identifier,
        branch,
        company,
        role,
        salary,
        academic_year,
        batch_year,
        skills_json,
        placed_date
      FROM historical_placements
      ORDER BY placed_date DESC
    `).all()

    allEligibleRows = db.prepare(`
      SELECT academic_year, branch, eligible_count, total_students
      FROM historical_eligible_counts
    `).all()
  } else {
    allPlacementRows = db.prepare(`
      SELECT 
        a.id,
        u.id AS student_identifier,
        u.name AS student_name,
        u.branch,
        d.company,
        d.role,
        d.salary,
        COALESCE(NULLIF(d.academic_year, ''), '2025-26') AS academic_year,
        CASE 
          WHEN u.passout_year > 0 THEN u.passout_year 
          ELSE 2026 
        END AS batch_year,
        u.skills_json,
        a.applied_at AS placed_date
      FROM applications a
      JOIN drives d ON d.id = a.drive_id
      JOIN users u ON u.id = a.student_id
      WHERE a.status = 'Selected'
      ORDER BY a.applied_at DESC
    `).all()

    const studentCountByBranch = db.prepare(`
      SELECT branch, COUNT(*) AS count
      FROM users
      WHERE role = 'Student'
      GROUP BY branch
    `).all()

    allEligibleRows = studentCountByBranch.map((sc) => ({
      academic_year: '2025-26',
      branch: sc.branch,
      eligible_count: sc.count,
      total_students: sc.count,
    }))
  }

  // Extract distinct filter options from the full pool
  const availableYearsSet = new Set()
  const availableBranchesSet = new Set()
  const availableCompaniesSet = new Set()
  const availableBatchesSet = new Set()

  allPlacementRows.forEach((r) => {
    if (r.academic_year) availableYearsSet.add(r.academic_year)
    if (r.branch) availableBranchesSet.add(r.branch)
    if (r.company) availableCompaniesSet.add(r.company)
    if (r.batch_year) availableBatchesSet.add(String(r.batch_year))
  })

  // If eligible table has more years/branches, include them
  allEligibleRows.forEach((e) => {
    if (e.academic_year) availableYearsSet.add(e.academic_year)
    if (e.branch) availableBranchesSet.add(e.branch)
  })

  const availableYears = Array.from(availableYearsSet).sort()
  const availableBranches = Array.from(availableBranchesSet).sort()
  const availableCompanies = Array.from(availableCompaniesSet).sort()
  const availableBatches = Array.from(availableBatchesSet).sort((a, b) => Number(a) - Number(b))

  // Apply filters to placement rows
  const filteredPlacements = allPlacementRows.filter((r) => {
    if (academicYear !== 'All' && r.academic_year !== academicYear) return false
    if (branch !== 'All' && r.branch !== branch) return false
    if (company !== 'All' && r.company !== company) return false
    if (batch !== 'All' && String(r.batch_year) !== String(batch)) return false
    return true
  })

  // Apply filters to eligible student rows
  const filteredEligible = allEligibleRows.filter((e) => {
    if (academicYear !== 'All' && e.academic_year !== academicYear) return false
    if (branch !== 'All' && e.branch !== branch) return false
    return true
  })

  // Metric: Unique students placed vs total offers
  const uniquePlacedStudentIds = new Set(filteredPlacements.map((r) => r.student_identifier))
  const totalPlaced = uniquePlacedStudentIds.size
  const totalOffers = filteredPlacements.length

  // Metric: Total eligible students for the filtered denominator
  let totalEligible = filteredEligible.reduce((acc, e) => acc + (Number(e.eligible_count) || 0), 0)
  if (totalEligible === 0 && totalPlaced > 0) {
    totalEligible = totalPlaced
  }

  // Metric: Placement percentage
  const placementPercentage = totalEligible > 0
    ? Math.round(((totalPlaced / totalEligible) * 100) * 10) / 10
    : 0.0

  // Metric: Participating companies
  const participatingCompanies = new Set(filteredPlacements.map((r) => r.company)).size

  // Packages (in LPA)
  const salaryLpas = filteredPlacements.map((r) => normalizeSalaryToLpa(r.salary)).filter((s) => s > 0)
  const highestPackage = salaryLpas.length ? Math.max(...salaryLpas) : 0
  const averagePackage = salaryLpas.length
    ? Math.round((salaryLpas.reduce((sum, val) => sum + val, 0) / salaryLpas.length) * 10) / 10
    : 0
  const medianPackage = computeMedian(salaryLpas)

  // -------------------------------------------------------------------------
  // Graph A & D: Year-wise Placement Trends & Growth Over Time
  // -------------------------------------------------------------------------
  const yearGroups = {}
  allPlacementRows.forEach((r) => {
    // Apply branch & company filters if active, but keep all years for trend comparison
    if (branch !== 'All' && r.branch !== branch) return
    if (company !== 'All' && r.company !== company) return
    if (!yearGroups[r.academic_year]) {
      yearGroups[r.academic_year] = {
        year: r.academic_year,
        uniqueStudents: new Set(),
        offers: 0,
        salaries: [],
      }
    }
    yearGroups[r.academic_year].uniqueStudents.add(r.student_identifier)
    yearGroups[r.academic_year].offers++
    const sal = normalizeSalaryToLpa(r.salary)
    if (sal > 0) yearGroups[r.academic_year].salaries.push(sal)
  })

  const yearEligibleMap = {}
  allEligibleRows.forEach((e) => {
    if (branch !== 'All' && e.branch !== branch) return
    yearEligibleMap[e.academic_year] = (yearEligibleMap[e.academic_year] || 0) + Number(e.eligible_count || 0)
  })

  const sortedDistinctYears = Array.from(new Set([...Object.keys(yearGroups), ...Object.keys(yearEligibleMap)])).sort()

  let prevPlacedCount = null
  const yearWiseTrends = []
  const growthOverTime = []

  sortedDistinctYears.forEach((yr) => {
    const yg = yearGroups[yr]
    const placed = yg ? yg.uniqueStudents.size : 0
    const offers = yg ? yg.offers : 0
    const eligible = yearEligibleMap[yr] || placed
    const pct = eligible > 0 ? Math.round(((placed / eligible) * 100) * 10) / 10 : 0
    const avgSal = yg && yg.salaries.length ? Math.round((yg.salaries.reduce((a, b) => a + b, 0) / yg.salaries.length) * 10) / 10 : 0

    yearWiseTrends.push({
      year: yr,
      placed,
      offers,
      eligible,
      placementPercentage: pct,
      averagePackage: avgSal,
    })

    let growthRate = null
    if (prevPlacedCount !== null && prevPlacedCount > 0) {
      growthRate = Math.round((((placed - prevPlacedCount) / prevPlacedCount) * 100) * 10) / 10
    }
    growthOverTime.push({
      year: yr,
      placed,
      offers,
      growthRate,
    })
    prevPlacedCount = placed
  })

  // Metric: YoY Placement Growth for current selection
  let yoyGrowth = null
  if (academicYear !== 'All') {
    const currentIndex = sortedDistinctYears.indexOf(academicYear)
    if (currentIndex > 0) {
      const prevYr = sortedDistinctYears[currentIndex - 1]
      const prevCount = yearGroups[prevYr]?.uniqueStudents.size || 0
      if (prevCount > 0) {
        yoyGrowth = Math.round((((totalPlaced - prevCount) / prevCount) * 100) * 10) / 10
      }
    }
  } else if (growthOverTime.length >= 2) {
    // If All years, use growth from the latest complete year
    const lastItem = growthOverTime[growthOverTime.length - 1]
    yoyGrowth = lastItem.growthRate
  }

  // -------------------------------------------------------------------------
  // Graph B & C: Branch-wise Comparison & Distribution
  // -------------------------------------------------------------------------
  const branchMap = {}
  filteredPlacements.forEach((r) => {
    if (!branchMap[r.branch]) {
      branchMap[r.branch] = {
        branch: r.branch,
        uniqueStudents: new Set(),
        offers: 0,
        salaries: [],
      }
    }
    branchMap[r.branch].uniqueStudents.add(r.student_identifier)
    branchMap[r.branch].offers++
    const sal = normalizeSalaryToLpa(r.salary)
    if (sal > 0) branchMap[r.branch].salaries.push(sal)
  })

  const branchEligibleMap = {}
  filteredEligible.forEach((e) => {
    branchEligibleMap[e.branch] = (branchEligibleMap[e.branch] || 0) + Number(e.eligible_count || 0)
  })

  const distinctFilteredBranches = Array.from(new Set([...Object.keys(branchMap), ...Object.keys(branchEligibleMap)])).sort()

  const branchComparison = distinctFilteredBranches.map((bName) => {
    const bg = branchMap[bName]
    const placed = bg ? bg.uniqueStudents.size : 0
    const offers = bg ? bg.offers : 0
    const eligible = branchEligibleMap[bName] || placed
    const pct = eligible > 0 ? Math.round(((placed / eligible) * 100) * 10) / 10 : 0
    const salaries = bg ? bg.salaries : []
    const avgPkg = salaries.length ? Math.round((salaries.reduce((sum, v) => sum + v, 0) / salaries.length) * 10) / 10 : 0
    const maxPkg = salaries.length ? Math.max(...salaries) : 0
    const medPkg = computeMedian(salaries)

    return {
      branch: bName,
      placed,
      offers,
      eligible,
      percentage: pct,
      placementPercentage: pct,
      avgPackage: avgPkg,
      medianPackage: medPkg,
      highestPackage: maxPkg,
    }
  }).sort((a, b) => b.placed - a.placed)

  const branchDistribution = branchComparison
    .filter((b) => b.placed > 0)
    .map((b) => ({
      name: b.branch,
      value: b.placed,
      percentage: totalPlaced > 0 ? Math.round(((b.placed / totalPlaced) * 100) * 10) / 10 : 0,
    }))

  // -------------------------------------------------------------------------
  // Graph E: Company-wise Placement Statistics
  // -------------------------------------------------------------------------
  const companyAgg = {}
  filteredPlacements.forEach((r) => {
    if (!companyAgg[r.company]) {
      companyAgg[r.company] = {
        company: r.company,
        count: 0,
        uniqueStudents: new Set(),
        salaries: [],
      }
    }
    companyAgg[r.company].count++
    companyAgg[r.company].uniqueStudents.add(r.student_identifier)
    const sal = normalizeSalaryToLpa(r.salary)
    if (sal > 0) companyAgg[r.company].salaries.push(sal)
  })

  const companyStats = Object.values(companyAgg).map((c) => ({
    company: c.company,
    count: c.count,
    uniquePlaced: c.uniqueStudents.size,
    avgPackage: c.salaries.length ? Math.round((c.salaries.reduce((s, v) => s + v, 0) / c.salaries.length) * 10) / 10 : 0,
    highestPackage: c.salaries.length ? Math.max(...c.salaries) : 0,
  })).sort((a, b) => b.count - a.count).slice(0, 10)

  // -------------------------------------------------------------------------
  // Graph F: Package Analysis Across Branches
  // -------------------------------------------------------------------------
  const packageAnalysis = branchComparison
    .filter((b) => b.avgPackage > 0)
    .map((b) => ({
      category: b.branch,
      avgPackage: b.avgPackage,
      medianPackage: b.medianPackage,
      highestPackage: b.highestPackage,
    }))

  // -------------------------------------------------------------------------
  // Top In-Demand Skills
  // -------------------------------------------------------------------------
  const skillFrequency = {}
  filteredPlacements.forEach((r) => {
    const sList = parseJson(r.skills_json, [])
    sList.forEach((s) => {
      const clean = String(s || '').trim()
      if (clean) {
        skillFrequency[clean] = (skillFrequency[clean] || 0) + 1
      }
    })
  })

  const topSkills = Object.entries(skillFrequency)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    meta: {
      isDemoMode: isDemo,
      dataSource: isDemo ? 'Historical Presentation Archive' : 'Active Campus Placement Drives',
      filters: { academicYear, branch, company, batch },
    },
    summary: {
      totalPlaced,
      totalOffers,
      totalEligible,
      placementPercentage,
      participatingCompanies,
      highestPackage,
      averagePackage,
      medianPackage,
      yoyGrowth,
    },
    charts: {
      yearWiseTrends,
      branchComparison,
      branchDistribution,
      growthOverTime,
      companyStats,
      packageAnalysis,
      topSkills,
    },
    filters: {
      availableYears,
      availableBranches,
      availableCompanies,
      availableBatches,
    },
    records: filteredPlacements.slice(0, 100).map((r) => ({
      id: r.id,
      studentName: r.student_name,
      studentIdentifier: r.student_identifier,
      branch: r.branch,
      company: r.company,
      role: r.role,
      packageLpa: normalizeSalaryToLpa(r.salary),
      academicYear: r.academic_year,
      batchYear: r.batch_year,
      placedDate: r.placed_date,
    })),
  }
}

export function getPlacementRecordsForExport({
  academicYear = 'All',
  branch = 'All',
  company = 'All',
  batch = 'All',
  demoMode = true,
}) {
  const isDemo = String(demoMode) === 'true' || demoMode === true

  let allPlacementRows = []
  if (isDemo) {
    allPlacementRows = db.prepare(`
      SELECT 
        id,
        student_name,
        student_identifier,
        branch,
        company,
        role,
        salary,
        academic_year,
        batch_year,
        skills_json,
        placed_date
      FROM historical_placements
      ORDER BY placed_date DESC
    `).all()
  } else {
    allPlacementRows = db.prepare(`
      SELECT 
        a.id,
        u.id AS student_identifier,
        u.name AS student_name,
        u.branch,
        d.company,
        d.role,
        d.salary,
        COALESCE(NULLIF(d.academic_year, ''), '2025-26') AS academic_year,
        CASE 
          WHEN u.passout_year > 0 THEN u.passout_year 
          ELSE 2026 
        END AS batch_year,
        u.skills_json,
        a.applied_at AS placed_date
      FROM applications a
      JOIN drives d ON d.id = a.drive_id
      JOIN users u ON u.id = a.student_id
      WHERE a.status = 'Selected'
      ORDER BY a.applied_at DESC
    `).all()
  }

  return allPlacementRows
    .filter((r) => {
      if (academicYear !== 'All' && r.academic_year !== academicYear) return false
      if (branch !== 'All' && r.branch !== branch) return false
      if (company !== 'All' && r.company !== company) return false
      if (batch !== 'All' && String(r.batch_year) !== String(batch)) return false
      return true
    })
    .map((r) => ({
      id: r.id,
      studentName: r.student_name,
      studentIdentifier: r.student_identifier,
      branch: r.branch,
      company: r.company,
      role: r.role,
      packageLpa: normalizeSalaryToLpa(r.salary),
      academicYear: r.academic_year,
      batchYear: r.batch_year,
      placedDate: r.placed_date,
    }))
}

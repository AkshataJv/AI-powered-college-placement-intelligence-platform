/**
 * AI Service Integration Module
 * Communicates statelessly with the Python FastAPI AI microservice over HTTP.
 */

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

/**
 * Sends a resume PDF buffer to the Python AI service for parsing.
 * 
 * @param {Buffer} fileBuffer - In-memory resume file buffer
 * @param {string} [originalFilename='resume.pdf'] - Original filename of the uploaded PDF
 * @returns {Promise<{raw_text: string, word_count: number, skills: string[], education: Array, experience: Array}>}
 */
export async function analyzeResume(fileBuffer, originalFilename = 'resume.pdf') {
  if (!fileBuffer || fileBuffer.length === 0) {
    const emptyErr = new Error('Resume file buffer is empty.')
    emptyErr.status = 400
    throw emptyErr
  }

  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: 'application/pdf' })
  formData.append('file', blob, originalFilename)

  const controller = new AbortController()
  const timeoutMs = 15000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${AI_SERVICE_URL}/parse-resume`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      let detail = ''
      try {
        const errorData = await response.json()
        detail = errorData.detail || errorData.error || JSON.stringify(errorData)
      } catch {
        detail = await response.text().catch(() => '')
      }

      const err = new Error(`AI service responded with status ${response.status}: ${detail}`)
      err.status = response.status
      err.detail = detail
      throw err
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    // If it's an HTTP error from the AI service response, rethrow it directly
    if (error.status) {
      throw error
    }

    // Network error, connection refused, or AbortError timeout
    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/parse-resume failed:`, error.message || error)
    const unavailableError = new Error('AI_SERVICE_UNAVAILABLE')
    unavailableError.cause = error
    throw unavailableError
  }
}

/**
 * Computes semantic skill match score and breakdown for a single candidate.
 * 
 * @param {string[]} requiredSkills - Required skills list from job drive
 * @param {string[]} [preferredSkills=[]] - Preferred skills list from job drive
 * @param {string[]} [keywords=[]] - Relevant keywords list from job drive
 * @param {string[]} candidateSkills - Candidate's extracted/profile skills
 * @returns {Promise<{semantic_score: number, required: object, preferred: object, keywords: object, explanation: string}>}
 */
export async function computeSemanticMatch(requiredSkills, preferredSkills = [], keywords = [], candidateSkills = []) {
  const controller = new AbortController()
  const timeoutMs = 15000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${AI_SERVICE_URL}/match-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        required_skills: Array.isArray(requiredSkills) ? requiredSkills : [],
        preferred_skills: Array.isArray(preferredSkills) ? preferredSkills : [],
        keywords: Array.isArray(keywords) ? keywords : [],
        candidate_skills: Array.isArray(candidateSkills) ? candidateSkills : [],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      let detail = ''
      try {
        const errorData = await response.json()
        detail = errorData.detail || errorData.error || JSON.stringify(errorData)
      } catch {
        detail = await response.text().catch(() => '')
      }

      const err = new Error(`AI service responded with status ${response.status}: ${detail}`)
      err.status = response.status
      err.detail = detail
      throw err
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    if (error.status) {
      throw error
    }

    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/match-score failed:`, error.message || error)
    const unavailableError = new Error('AI_SERVICE_UNAVAILABLE')
    unavailableError.cause = error
    throw unavailableError
  }
}

/**
 * Computes semantic skill match score and breakdown for a batch of candidates.
 * 
 * @param {string[]} requiredSkills - Required skills list from job drive
 * @param {string[]} [preferredSkills=[]] - Preferred skills list from job drive
 * @param {string[]} [keywords=[]] - Relevant keywords list from job drive
 * @param {Array<{student_id: string, skills: string[]}>} candidates - Batch of candidate records
 * @returns {Promise<{results: Array<{student_id: string, semantic_score: number, required: object, preferred: object, keywords: object, explanation: string}>}>}
 */
export async function computeBatchSemanticMatch(requiredSkills, preferredSkills = [], keywords = [], candidates = []) {
  const controller = new AbortController()
  const timeoutMs = 15000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${AI_SERVICE_URL}/match-score/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        required_skills: Array.isArray(requiredSkills) ? requiredSkills : [],
        preferred_skills: Array.isArray(preferredSkills) ? preferredSkills : [],
        keywords: Array.isArray(keywords) ? keywords : [],
        candidates: Array.isArray(candidates) ? candidates : [],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      let detail = ''
      try {
        const errorData = await response.json()
        detail = errorData.detail || errorData.error || JSON.stringify(errorData)
      } catch {
        detail = await response.text().catch(() => '')
      }

      const err = new Error(`AI service responded with status ${response.status}: ${detail}`)
      err.status = response.status
      err.detail = detail
      throw err
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    if (error.status) {
      throw error
    }

    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/match-score/batch failed:`, error.message || error)
    const unavailableError = new Error('AI_SERVICE_UNAVAILABLE')
    unavailableError.cause = error
    throw unavailableError
  }
}

/**
 * Sends aggregated placement statistics to the Python AI service for observations and recommendations.
 * 
 * @param {object} aggregatedStats - Pre-calculated metrics, breakdowns and skill stats
 * @returns {Promise<{status: string, executive_summary: string, observations: Array, recommendations: Array, data_highlights: object}>}
 */
export async function generatePlacementInsights(aggregatedStats) {
  const controller = new AbortController()
  const timeoutMs = 15000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const summary = aggregatedStats?.summary || aggregatedStats || {}
  const charts = aggregatedStats?.charts || {}
  const filters = aggregatedStats?.meta?.filters || aggregatedStats?.filters || {}

  const payload = {
    academic_year: filters.academicYear || filters.academic_year || 'All',
    branch: filters.branch || 'All',
    company: filters.company || 'All',
    total_placed: Number(summary.totalPlaced ?? summary.total_placed ?? 0),
    total_offers: Number(summary.totalOffers ?? summary.total_offers ?? 0),
    total_eligible: Number(summary.totalEligible ?? summary.total_eligible ?? 0),
    placement_percentage: Number(summary.placementPercentage ?? summary.placement_percentage ?? 0),
    highest_package: Number(summary.highestPackage ?? summary.highest_package ?? 0),
    average_package: Number(summary.averagePackage ?? summary.average_package ?? 0),
    median_package: Number(summary.medianPackage ?? summary.median_package ?? 0),
    yoy_growth: summary.yoyGrowth !== undefined && summary.yoyGrowth !== null ? Number(summary.yoyGrowth) : (summary.yoy_growth !== undefined ? Number(summary.yoy_growth) : null),
    yearly_trends: (charts.yearWiseTrends || []).map((y) => ({
      year: y.year,
      placed: y.placed || 0,
      offers: y.offers || 0,
      eligible: y.eligible || 0,
      placement_percentage: y.placementPercentage || 0,
    })),
    branch_stats: (charts.branchComparison || []).map((b) => ({
      branch: b.branch,
      placed: b.placed || 0,
      eligible: b.eligible || 0,
      placement_percentage: b.placementPercentage || b.percentage || 0,
      avg_package: b.avgPackage || 0,
      highest_package: b.highestPackage || 0,
    })),
    company_stats: (charts.companyStats || []).map((c) => ({
      company: c.company,
      count: c.count || 0,
      avg_package: c.avgPackage || 0,
    })),
    top_skills: (charts.topSkills || []).map((s) => ({
      skill: s.skill,
      count: s.count || 0,
    })),
  }

  try {
    const response = await fetch(`${AI_SERVICE_URL}/analytics/placement-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      let detail = ''
      try {
        const errorData = await response.json()
        detail = errorData.detail || errorData.error || JSON.stringify(errorData)
      } catch {
        detail = await response.text().catch(() => '')
      }

      const err = new Error(`AI service responded with status ${response.status}: ${detail}`)
      err.status = response.status
      err.detail = detail
      throw err
    }

    const data = await response.json()
    return {
      ...data,
      source: 'fastapi-ai',
      key_observations: (data.observations || []).map((o) => typeof o === 'string' ? o : `${o.title ? o.title + ': ' : ''}${o.text}`),
      student_preparation_guidance: data.recommendations || [],
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error.status) {
      throw error
    }

    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/analytics/placement-insights failed:`, error.message || error)
    const unavailableError = new Error('AI_SERVICE_UNAVAILABLE')
    unavailableError.cause = error
    throw unavailableError
  }
}

/**
 * Calculates placement readiness score and breakdown for a student.
 */
export async function calculateReadinessScore(payload) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${AI_SERVICE_URL}/readiness/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      const err = new Error(`AI service responded with status ${response.status}: ${errData.detail || response.statusText}`)
      err.status = response.status
      throw err
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.status) throw error
    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/readiness/calculate failed:`, error.message || error)
    const err = new Error('AI_SERVICE_UNAVAILABLE')
    err.cause = error
    throw err
  }
}

/**
 * Performs skill gap analysis against target company / role.
 */
export async function analyzeSkillGap(payload) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${AI_SERVICE_URL}/skill-gap/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      const err = new Error(`AI service responded with status ${response.status}: ${errData.detail || response.statusText}`)
      err.status = response.status
      throw err
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.status) throw error
    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/skill-gap/analyze failed:`, error.message || error)
    const err = new Error('AI_SERVICE_UNAVAILABLE')
    err.cause = error
    throw err
  }
}

/**
 * Performs ATS resume analysis against target role keywords.
 */
export async function analyzeResumeATS(payload) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${AI_SERVICE_URL}/resume/ats-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      const err = new Error(`AI service responded with status ${response.status}: ${errData.detail || response.statusText}`)
      err.status = response.status
      throw err
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.status) throw error
    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/resume/ats-analyze failed:`, error.message || error)
    const err = new Error('AI_SERVICE_UNAVAILABLE')
    err.cause = error
    throw err
  }
}

/**
 * Generates structured career preparation roadmap.
 */
export async function generateCareerRoadmap(payload) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${AI_SERVICE_URL}/roadmap/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      const err = new Error(`AI service responded with status ${response.status}: ${errData.detail || response.statusText}`)
      err.status = response.status
      throw err
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.status) throw error
    console.error(`[AI Service Error] Request to ${AI_SERVICE_URL}/roadmap/generate failed:`, error.message || error)
    const err = new Error('AI_SERVICE_UNAVAILABLE')
    err.cause = error
    throw err
  }
}



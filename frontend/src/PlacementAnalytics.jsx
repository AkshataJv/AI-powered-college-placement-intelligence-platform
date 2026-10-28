import { useEffect, useState, useId } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { apiRequest } from './api'

const CHART_PALETTE = [
  '#0F766E', // Teal (Primary)
  '#0EA5E9', // Sky Blue (Accent)
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#3B82F6', // Blue
]

function CustomChartTooltip({ active, payload, label, unit = '' }) {
  if (active && payload && payload.length) {
    return (
      <div className="analytics-custom-tooltip">
        <p className="analytics-tooltip-label">{label}</p>
        <div className="analytics-tooltip-items">
          {payload.map((item) => (
            <div key={item.name} className="analytics-tooltip-row">
              <span className="analytics-tooltip-dot" style={{ backgroundColor: item.color || item.fill }} />
              <span className="analytics-tooltip-name">{item.name}:</span>
              <span className="analytics-tooltip-value">
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                {unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export function PlacementAnalytics({ user: _user }) {
  const [demoMode, setDemoMode] = useState(true)
  const [filters, setFilters] = useState({
    academicYear: 'All',
    branch: 'All',
    company: 'All',
    batch: 'All',
  })

  const [data, setData] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchRecord, setSearchRecord] = useState('')
  const [showRecords, setShowRecords] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Unique IDs for form accessibility
  const yearSelectId = useId()
  const branchSelectId = useId()
  const companySelectId = useId()
  const batchSelectId = useId()
  const demoToggleId = useId()
  const searchInputId = useId()

  // Load analytics whenever filters or demoMode change
  useEffect(() => {
    let isCancelled = false

    async function fetchAnalytics() {
      setLoading(true)
      setError(null)
      try {
        const queryParams = new URLSearchParams({
          academic_year: filters.academicYear,
          branch: filters.branch,
          company: filters.company,
          batch: filters.batch,
          demo_mode: String(demoMode),
        })

        const res = await apiRequest(`/analytics/placement-stats?${queryParams.toString()}`)
        if (isCancelled) return

        setData(res)

        // Automatically fetch AI insights for the newly loaded aggregated dataset
        fetchAiInsights(res)
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching placement analytics:', err)
          setError(err.message || 'Failed to load placement analytics.')
        }
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    fetchAnalytics()

    return () => {
      isCancelled = true
    }
  }, [filters, demoMode])

  async function fetchAiInsights(aggregatedData) {
    if (!aggregatedData) return
    setInsightsLoading(true)
    try {
      const res = await apiRequest('/analytics/ai-insights', {
        method: 'POST',
        body: { aggregatedStats: aggregatedData },
      })
      setInsights(res)
    } catch (err) {
      console.warn('AI insights fetch fallback triggered:', err)
      setInsights({
        executive_summary: 'Statistical trends aggregated successfully. AI microservice is currently in offline fallback mode.',
        key_observations: [
          'High demand recorded for software engineering, full-stack, and analytics positions.',
          'Placement percentages remain stable across engineering departments.',
        ],
        student_preparation_guidance: [
          'Reinforce data structures, algorithms, and modular object-oriented coding skills.',
          'Complete hands-on projects featuring end-to-end API and database integration.',
        ],
        source: 'backend-rules',
        status: 'fallback',
      })
    } finally {
      setInsightsLoading(false)
    }
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleResetFilters() {
    setFilters({
      academicYear: 'All',
      branch: 'All',
      company: 'All',
      batch: 'All',
    })
  }

  async function handleExportCsv() {
    setExporting(true)
    try {
      const queryParams = new URLSearchParams({
        academic_year: filters.academicYear,
        branch: filters.branch,
        company: filters.company,
        batch: filters.batch,
        demo_mode: String(demoMode),
      })

      const token = sessionStorage.getItem('careerBridgeToken')
      const response = await fetch(`/api/analytics/export?${queryParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) throw new Error('Failed to download CSV report.')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `placement-analytics-report-${filters.academicYear.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch (err) {
      console.error('CSV export failed:', err)
      alert('Could not export placement report. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  function handlePrintReport() {
    window.print()
  }

  const summary = data?.summary || {}
  const charts = data?.charts || {}
  const availableFilters = data?.filters || {
    availableYears: [],
    availableBranches: [],
    availableCompanies: [],
    availableBatches: [],
  }

  const filteredRecords = (data?.records || []).filter((r) => {
    if (!searchRecord) return true
    const q = searchRecord.toLowerCase()
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.studentIdentifier.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q) ||
      r.branch.toLowerCase().includes(q)
    )
  })

  const hasActiveFilters =
    filters.academicYear !== 'All' ||
    filters.branch !== 'All' ||
    filters.company !== 'All' ||
    filters.batch !== 'All'

  return (
    <main className="workspace-content placement-analytics-page" id="placement-analytics-view">
      {/* Page Header */}
      <header className="analytics-header">
        <div className="analytics-header-titles">
          <div className="analytics-badge-row">
            <span className="analytics-eyebrow">INTELLIGENCE &amp; ANALYTICS</span>
            <span className={`analytics-mode-pill ${demoMode ? 'mode-demo' : 'mode-live'}`}>
              {demoMode ? 'Presentation Mode: Historical Archive' : 'Live Campus Drives Mode'}
            </span>
          </div>
          <h1 className="analytics-title">Placement Statistics &amp; Intelligence</h1>
          <p className="analytics-subtitle">
            Comprehensive verified placement statistics, branch-wise conversion benchmarks, hiring partner distributions, and AI-synthesized cohort insights.
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="analytics-header-actions no-print">
          <div className="analytics-toggle-group">
            <label className="analytics-toggle-label" htmlFor={demoToggleId}>
              <span className="toggle-title">Historical Presentation Data</span>
              <span className="toggle-caption">{demoMode ? 'Enabled (2022–26)' : 'Live only'}</span>
            </label>
            <input
              id={demoToggleId}
              type="checkbox"
              className="analytics-toggle-checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              aria-label="Toggle demo presentation data mode"
            />
          </div>

          <button
            className="secondary-button analytics-btn"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            type="button"
            id="export-csv-button"
          >
            {exporting ? 'Generating CSV...' : 'Export CSV Report'}
          </button>

          <button
            className="primary-button analytics-btn"
            onClick={handlePrintReport}
            type="button"
            id="print-report-button"
          >
            Print / PDF Report
          </button>
        </div>
      </header>

      {/* Mode Callout Banner */}
      <aside className={`analytics-callout-banner ${demoMode ? 'banner-demo' : 'banner-live'} no-print`} aria-label="Data source information">
        <div className="callout-icon" aria-hidden="true">
          {demoMode ? 'ℹ️' : '🔒'}
        </div>
        <div className="callout-content">
          <strong>{demoMode ? 'Historical Archive Mode Active:' : 'Live Campus Data Active:'}</strong>{' '}
          {demoMode
            ? 'Displaying 1,566 verified placement records across 4 academic cycles (2022–23 through 2025–26) for institutional presentation and graph intelligence. Real applicant records remain strictly separate.'
            : 'Displaying verified selections from active campus recruitment drives and registered students in the system.'}
        </div>
      </aside>

      {/* Filter Toolbar */}
      <section className="analytics-filter-toolbar no-print" aria-label="Placement Filters">
        <div className="filter-group">
          <label htmlFor={yearSelectId}>Academic Year</label>
          <select
            id={yearSelectId}
            value={filters.academicYear}
            onChange={(e) => handleFilterChange('academicYear', e.target.value)}
          >
            <option value="All">All Years</option>
            {availableFilters.availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor={branchSelectId}>Engineering Branch</label>
          <select
            id={branchSelectId}
            value={filters.branch}
            onChange={(e) => handleFilterChange('branch', e.target.value)}
          >
            <option value="All">All Branches</option>
            {availableFilters.availableBranches.map((br) => (
              <option key={br} value={br}>
                {br}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor={companySelectId}>Recruiting Company</label>
          <select
            id={companySelectId}
            value={filters.company}
            onChange={(e) => handleFilterChange('company', e.target.value)}
          >
            <option value="All">All Companies</option>
            {availableFilters.availableCompanies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor={batchSelectId}>Graduation Batch</label>
          <select
            id={batchSelectId}
            value={filters.batch}
            onChange={(e) => handleFilterChange('batch', e.target.value)}
          >
            <option value="All">All Batches</option>
            {availableFilters.availableBatches.map((b) => (
              <option key={b} value={b}>
                Class of {b}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-actions">
          {hasActiveFilters && (
            <button
              className="quiet-button reset-filter-btn"
              onClick={handleResetFilters}
              type="button"
              id="reset-filters-btn"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </section>

      {/* Error View */}
      {error && (
        <div className="analytics-error-banner" role="alert">
          <p>
            <strong>Error:</strong> {error}
          </p>
          <button className="primary-button" onClick={() => handleFilterChange('academicYear', 'All')} type="button">
            Reset Filters
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="analytics-loading-state" aria-live="polite">
          <div className="analytics-spinner" />
          <p>Calculating verified placement statistics and rendering analytics...</p>
        </div>
      )}

      {/* Main Content Dashboard */}
      {data && (
        <>
          {/* Summary Metric Cards */}
          <section className="analytics-metrics-grid" aria-label="Placement KPI Metrics">
            {/* Card 1: Students Placed */}
            <article className="metric-card card-placed">
              <header className="metric-header">
                <span className="metric-label">TOTAL STUDENTS PLACED</span>
                <span className="metric-icon" aria-hidden="true">🎓</span>
              </header>
              <div className="metric-value">{summary.totalPlaced?.toLocaleString() ?? 0}</div>
              <footer className="metric-subtext">
                Unique students placed &bull; <strong>{summary.totalOffers?.toLocaleString() ?? 0}</strong> total offers
              </footer>
            </article>

            {/* Card 2: Eligible Students */}
            <article className="metric-card card-eligible">
              <header className="metric-header">
                <span className="metric-label">ELIGIBLE COHORT</span>
                <span className="metric-icon" aria-hidden="true">👥</span>
              </header>
              <div className="metric-value">{summary.totalEligible?.toLocaleString() ?? 'N/A'}</div>
              <footer className="metric-subtext">
                Registered eligible candidates across selection
              </footer>
            </article>

            {/* Card 3: Placement Percentage */}
            <article className="metric-card card-percentage">
              <header className="metric-header">
                <span className="metric-label">OVERALL PLACEMENT RATE</span>
                <span className="metric-icon" aria-hidden="true">📊</span>
              </header>
              <div className="metric-value">
                {summary.placementPercentage !== null && summary.placementPercentage !== undefined
                  ? `${summary.placementPercentage}%`
                  : 'N/A'}
              </div>
              <div className="metric-progress-track">
                <div
                  className="metric-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, summary.placementPercentage || 0))}%` }}
                />
              </div>
              <footer className="metric-subtext">
                (Unique Placed / Eligible Students) &times; 100
              </footer>
            </article>

            {/* Card 4: Companies */}
            <article className="metric-card card-companies">
              <header className="metric-header">
                <span className="metric-label">HIRING COMPANIES</span>
                <span className="metric-icon" aria-hidden="true">🏢</span>
              </header>
              <div className="metric-value">{summary.participatingCompanies ?? 0}</div>
              <footer className="metric-subtext">
                Active corporate recruiting partners
              </footer>
            </article>

            {/* Card 5: Highest Package */}
            <article className="metric-card card-highest">
              <header className="metric-header">
                <span className="metric-label">HIGHEST PACKAGE</span>
                <span className="metric-icon" aria-hidden="true">🏆</span>
              </header>
              <div className="metric-value">
                {summary.highestPackage > 0 ? `₹${summary.highestPackage} LPA` : 'N/A'}
              </div>
              <footer className="metric-subtext">
                Peak verified CTC offer
              </footer>
            </article>

            {/* Card 6: Average & Median Package */}
            <article className="metric-card card-average">
              <header className="metric-header">
                <span className="metric-label">AVG &amp; MEDIAN PACKAGE</span>
                <span className="metric-icon" aria-hidden="true">💼</span>
              </header>
              <div className="metric-value">
                {summary.averagePackage > 0 ? `₹${summary.averagePackage} LPA` : 'N/A'}
              </div>
              <footer className="metric-subtext">
                Median compensation: <strong>₹{summary.medianPackage || 0} LPA</strong>
              </footer>
            </article>

            {/* Card 7: YoY Growth */}
            <article className="metric-card card-growth">
              <header className="metric-header">
                <span className="metric-label">YOY PLACEMENT GROWTH</span>
                <span className="metric-icon" aria-hidden="true">📈</span>
              </header>
              <div className="metric-value-row">
                <span className={`metric-value ${summary.yoyGrowth >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {summary.yoyGrowth !== null && summary.yoyGrowth !== undefined
                    ? `${summary.yoyGrowth >= 0 ? '+' : ''}${summary.yoyGrowth}%`
                    : 'Baseline'}
                </span>
              </div>
              <footer className="metric-subtext">
                Compared to preceding academic cycle
              </footer>
            </article>
          </section>

          {/* Empty State when filters yield 0 records */}
          {summary.totalPlaced === 0 && (
            <div className="analytics-empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No placement records match the selected filters</h3>
              <p>Try broadening your filter criteria or switching academic years.</p>
              <button className="primary-button" onClick={handleResetFilters} type="button">
                Clear Filters
              </button>
            </div>
          )}

          {/* Graphs Section */}
          {summary.totalPlaced > 0 && (
            <section className="analytics-charts-grid" aria-label="Interactive Placement Visualizations">
              {/* Chart A: Year-wise Placement Trend */}
              <article className="chart-card" id="chart-year-trend">
                <header className="chart-card-header">
                  <div>
                    <h2 className="chart-title">Year-wise Placement Trend</h2>
                    <p className="chart-subtitle">Students placed, total offers, and eligible cohort by academic year</p>
                  </div>
                </header>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={charts.yearWiseTrends || []}
                      margin={{ top: 20, right: 25, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="year" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="placed" name="Placed (Unique)" fill="#0F766E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="offers" name="Total Offers" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="eligible" name="Eligible Cohort" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Chart B: Branch-wise Placement Comparison */}
              <article className="chart-card" id="chart-branch-comparison">
                <header className="chart-card-header">
                  <div>
                    <h2 className="chart-title">Branch-wise Placement Comparison</h2>
                    <p className="chart-subtitle">Placement volume vs eligible students across departments</p>
                  </div>
                </header>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={charts.branchComparison || []}
                      margin={{ top: 20, right: 25, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="branch" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="placed" name="Placed Students" fill="#0F766E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="eligible" name="Eligible Students" fill="#64748B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Chart C: Branch-wise Placement Distribution */}
              <article className="chart-card" id="chart-branch-distribution">
                <header className="chart-card-header">
                  <div>
                    <h2 className="chart-title">Branch-wise Placement Distribution</h2>
                    <p className="chart-subtitle">Proportional share of total placed candidates by discipline</p>
                  </div>
                </header>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Tooltip
                        formatter={(val, name, entry) => [
                          `${val} students (${entry.payload.percentage || 0}%)`,
                          name,
                        ]}
                      />
                      <Legend verticalAlign="bottom" height={45} />
                      <Pie
                        data={charts.branchDistribution || []}
                        cx="50%"
                        cy="45%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {(charts.branchDistribution || []).map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Chart D: Placement Growth Over Time */}
              <article className="chart-card" id="chart-growth-trend">
                <header className="chart-card-header">
                  <div>
                    <h2 className="chart-title">Placement Growth Over Time</h2>
                    <p className="chart-subtitle">Multi-year placement progression and year-over-year growth %</p>
                  </div>
                </header>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart
                      data={charts.growthOverTime || []}
                      margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="year" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis yAxisId="left" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#0EA5E9"
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: '#0EA5E9' }}
                      />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend verticalAlign="top" height={36} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="placed"
                        name="Placed Students"
                        stroke="#0F766E"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#0F766E' }}
                        activeDot={{ r: 7 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="growthRate"
                        name="YoY Growth (%)"
                        stroke="#0EA5E9"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: '#0EA5E9' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Chart E: Company-wise Placement Statistics */}
              <article className="chart-card chart-wide" id="chart-company-stats">
                <header className="chart-card-header">
                  <div>
                    <h2 className="chart-title">Company-wise Placement Statistics</h2>
                    <p className="chart-subtitle">Top hiring organizations ranked by student selection volume</p>
                  </div>
                </header>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                      data={(charts.companyStats || []).slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 15, right: 30, left: 80, bottom: 15 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis
                        type="category"
                        dataKey="company"
                        stroke="var(--text-muted)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 13 }}
                      />
                      <Tooltip
                        formatter={(val, name, entry) => [
                          `${val} offers (Avg: ₹${entry.payload.avgPackage || 0} LPA)`,
                          name,
                        ]}
                      />
                      <Bar dataKey="count" name="Placed Students" fill="#0EA5E9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Chart F: Package Analysis */}
              <article className="chart-card chart-wide" id="chart-package-analysis">
                <header className="chart-card-header">
                  <div>
                    <h2 className="chart-title">Compensation &amp; Package Analysis</h2>
                    <p className="chart-subtitle">Highest, average, and median CTC benchmarks (LPA) across branches</p>
                  </div>
                </header>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                      data={charts.packageAnalysis || []}
                      margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="branch" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis
                        stroke="var(--text-muted)"
                        tickFormatter={(v) => `₹${v}L`}
                        tick={{ fill: 'var(--text-muted)' }}
                      />
                      <Tooltip content={<CustomChartTooltip unit=" LPA" />} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="avgPackage" name="Average Package" fill="#0F766E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="medianPackage" name="Median Package" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="highestPackage" name="Highest Package" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>
          )}

          {/* AI Placement Insights Section */}
          <section className="analytics-ai-section" id="ai-placement-insights" aria-label="AI Placement Insights">
            <header className="ai-section-header">
              <div className="ai-header-left">
                <div className="ai-sparkle-icon" aria-hidden="true">✦</div>
                <div>
                  <div className="ai-badge-row">
                    <h2 className="ai-section-title">AI Placement Insights &amp; Strategic Observations</h2>
                    <span
                      className={`ai-engine-status ${
                        insights?.source === 'fastapi-ai' ? 'status-live' : 'status-fallback'
                      }`}
                    >
                      {insights?.source === 'fastapi-ai'
                        ? 'FastAPI AI Engine'
                        : 'Rule-Based Offline Fallback'}
                    </span>
                  </div>
                  <p className="ai-section-subtitle">
                    Automated analytical observations generated from aggregated database statistics, trend trajectories, and skill correlations.
                  </p>
                </div>
              </div>

              <button
                className="secondary-button refresh-ai-btn no-print"
                onClick={() => fetchAiInsights(data)}
                disabled={insightsLoading}
                type="button"
                id="refresh-ai-insights-btn"
              >
                {insightsLoading ? 'Synthesizing...' : '↻ Re-evaluate Insights'}
              </button>
            </header>

            {/* Executive Summary */}
            {insights?.executive_summary && (
              <div className="ai-executive-summary-card">
                <div className="summary-title-row">
                  <span className="summary-pill">Executive Summary</span>
                  <span className="summary-scope">
                    Scope: {filters.academicYear === 'All' ? 'Multi-Year Timeline' : filters.academicYear} &bull;{' '}
                    {filters.branch === 'All' ? 'All Engineering Departments' : filters.branch}
                  </span>
                </div>
                <p className="summary-text">{insights.executive_summary}</p>
              </div>
            )}

            {/* Key Observations Grid */}
            <div className="ai-insights-grid">
              <div className="ai-column">
                <h3 className="ai-column-title">
                  <span className="col-icon" aria-hidden="true">🔍</span> Key Historical Observations
                </h3>
                <div className="observations-list">
                  {insights?.key_observations && insights.key_observations.length > 0 ? (
                    insights.key_observations.map((obs, idx) => (
                      <div key={idx} className="observation-card">
                        <div className="obs-num">0{idx + 1}</div>
                        <div className="obs-body">
                          <p>{obs}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="observation-card">
                      <div className="obs-body">
                        <p>Aggregating institutional placement metrics. Change filters to generate targeted branch observations.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="ai-column">
                <h3 className="ai-column-title">
                  <span className="col-icon" aria-hidden="true">🎯</span> Student Preparation Guidance
                </h3>
                <div className="recommendations-list">
                  {insights?.student_preparation_guidance && insights.student_preparation_guidance.length > 0 ? (
                    insights.student_preparation_guidance.map((rec, idx) => (
                      <div key={idx} className="recommendation-card">
                        <div className="rec-check">✓</div>
                        <div className="rec-body">
                          <p>{rec}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="recommendation-card">
                      <div className="rec-body">
                        <p>Focus on foundational algorithmic problem solving, core computer science subjects, and full-stack projects.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Collapsible Verified Records Table */}
          <section className="analytics-table-section no-print" aria-label="Placement Records">
            <header className="table-section-header">
              <div>
                <h2 className="table-title">Verified Placement Records</h2>
                <p className="table-subtitle">
                  Showing {filteredRecords.length} of {data.records?.length || 0} sample records for this selection
                </p>
              </div>
              <div className="table-header-actions">
                <button
                  className="secondary-button toggle-table-btn"
                  onClick={() => setShowRecords(!showRecords)}
                  type="button"
                  id="toggle-records-btn"
                >
                  {showRecords ? 'Hide Record Archive' : 'View Placement Records Table'}
                </button>
              </div>
            </header>

            {showRecords && (
              <div className="table-wrapper">
                <div className="table-search-bar">
                  <label htmlFor={searchInputId} className="visually-hidden">
                    Search placement records
                  </label>
                  <input
                    id={searchInputId}
                    type="search"
                    className="table-search-input"
                    placeholder="Search by student name, roll ID, company, role, or branch..."
                    value={searchRecord}
                    onChange={(e) => setSearchRecord(e.target.value)}
                  />
                </div>

                <div className="table-responsive">
                  <table className="placement-data-table">
                    <thead>
                      <tr>
                        <th>Student Roll / ID</th>
                        <th>Student Name</th>
                        <th>Branch</th>
                        <th>Company</th>
                        <th>Role</th>
                        <th>Package</th>
                        <th>Academic Year</th>
                        <th>Batch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.length > 0 ? (
                        filteredRecords.map((r) => (
                          <tr key={r.id}>
                            <td className="code-cell">{r.studentIdentifier}</td>
                            <td>
                              <strong>{r.studentName}</strong>
                            </td>
                            <td>
                              <span className="branch-tag">{r.branch}</span>
                            </td>
                            <td>{r.company}</td>
                            <td>{r.role}</td>
                            <td className="package-cell">₹{r.packageLpa} LPA</td>
                            <td>{r.academicYear}</td>
                            <td>{r.batchYear}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="empty-table-cell">
                            No records match &quot;{searchRecord}&quot;.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
export default PlacementAnalytics

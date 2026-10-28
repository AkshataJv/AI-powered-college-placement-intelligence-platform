import { Fragment, useEffect, useState } from 'react'
import { apiRequest, clearSession, downloadProtectedFile, getSession, protectedFileUrl, saveSession } from './api'
import {
  AlumniEditProfileTabPanel,
  AlumniProfileTopCard,
  ConnectModal,
  ConnectionRequestsView,
  PrivateChatView,
} from './ChatComponents'
import { PlacementAnalytics } from './PlacementAnalytics'
import { NoticeBoard, NotificationBell } from './NoticeBoard'
import './App.css'

const branches = ['All branches', 'CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML']
const ACADEMIC_YEARS = ['First Year', 'Second Year', 'Third Year', 'Final Year']
const roleRoutes = { Student: '/student', 'T&P Officer': '/tp', Alumni: '/alumni' }

function formatDate(date) {
  const value = String(date || '')
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : `${value.replace(' ', 'T')}${value.endsWith('Z') ? '' : 'Z'}`
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="m20.5 10.5-3 8-8 3 3-8 8-3Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  )
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'
  return (
    <button
      className="theme-toggle-btn"
      onClick={onToggle}
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      <span className="theme-label">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}

function Header({ user, onSignOut, activeAlumniTab, onSelectAlumniTab, theme, onToggleTheme }) {
  const isAlumniProfileActive = window.location.pathname === '/alumni' && (activeAlumniTab === 'Profile' || activeAlumniTab === 'My Profile' || (typeof window !== 'undefined' && window.location.search.includes('tab=profile')))
  const isAlumniHubActive = window.location.pathname === '/alumni' && !isAlumniProfileActive

  const roleLinks = user?.role === 'Student'
    ? [{ label: 'My Dashboard', href: '/student' }, { label: 'Alumni Hub', href: '/alumni' }]
    : user?.role === 'T&P Officer'
      ? [{ label: 'T&P Center', href: '/tp' }, { label: 'Create Drive', href: '/tp/create' }]
      : user?.role === 'Alumni'
        ? [
            { label: 'Alumni Hub', href: '/alumni', isSpecialActive: isAlumniHubActive },
            { label: 'Profile', href: '/alumni?tab=profile', isSpecialActive: isAlumniProfileActive },
          ]
        : []

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          <BrandMark />
          <span>CareerBridge <b>AI</b></span>
        </a>
        <div className="header-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          {user && <NotificationBell user={user} />}
          {user ? (
            <>
              <span className="signed-in">{user.name || user.role}</span>
              <button className="register-button" onClick={onSignOut} type="button">Sign out</button>
            </>
          ) : (
            <>
              <a className="sign-in-link" href="/login">Sign in</a>
              <a className="register-button" href="/register">Register</a>
            </>
          )}
        </div>
      </header>
      <nav className="site-nav" aria-label="Main navigation">
        {[
          { label: 'Drives', href: '/' },
          { label: 'Notice Board', href: '/notices' },
          ...roleLinks,
          { label: 'Placement Stats', href: '/analytics' },
        ].map((item) => {
          const isActive = item.isSpecialActive !== undefined
            ? item.isSpecialActive
            : window.location.pathname === item.href

          function handleClick(e) {
            if (user?.role === 'Alumni' && window.location.pathname === '/alumni') {
              if (item.href === '/alumni?tab=profile') {
                e.preventDefault()
                window.history.replaceState(null, '', '/alumni?tab=profile')
                if (onSelectAlumniTab) onSelectAlumniTab('Profile')
              } else if (item.href === '/alumni') {
                e.preventDefault()
                window.history.replaceState(null, '', '/alumni')
                if (onSelectAlumniTab) onSelectAlumniTab('Connection Requests')
              }
            }
          }

          return (
            <a
              className={isActive ? 'active' : ''}
              href={item.href}
              key={item.label}
              onClick={handleClick}
            >
              {item.label}
            </a>
          )
        })}
      </nav>
    </>
  )
}

function getEligibilityDetails(drive, profile) {
  if (!profile) {
    return {
      status: 'Eligibility Unconfirmed',
      reason: 'Sign in with a student account to confirm your eligibility.',
      isEligible: false,
      checks: null,
    }
  }

  const studentYear = profile.academicYear || ''
  const hasYear = Boolean(studentYear && ACADEMIC_YEARS.includes(studentYear))
  const hasBranch = Boolean(profile.branch)
  const hasCgpa = typeof profile.cgpa === 'number' && !isNaN(profile.cgpa)
  const hasBacklogs = typeof profile.backlogs === 'number' && !isNaN(profile.backlogs)

  const eligibleYears = Array.isArray(drive.eligibleYears) && drive.eligibleYears.length
    ? drive.eligibleYears
    : ['Final Year']

  if (!hasYear) {
    return {
      status: 'Eligibility Unconfirmed',
      reason: 'Academic year is not set in your profile. Please update your profile to confirm eligibility.',
      isEligible: false,
      checks: {
        year: { ok: false, missing: true, expected: eligibleYears, actual: 'Not set' },
        branch: { ok: hasBranch && drive.branches.includes(profile.branch), missing: !hasBranch, expected: drive.branches, actual: profile.branch || 'Not set' },
        cgpa: { ok: hasCgpa && profile.cgpa >= drive.cgpa, missing: !hasCgpa, expected: drive.cgpa, actual: profile.cgpa },
        backlogs: { ok: hasBacklogs && profile.backlogs <= drive.backlogs, missing: !hasBacklogs, expected: drive.backlogs, actual: profile.backlogs },
      },
    }
  }

  const yearOk = eligibleYears.includes(studentYear)
  const branchOk = drive.branches.includes(profile.branch)
  const cgpaOk = profile.cgpa >= drive.cgpa
  const backlogsOk = profile.backlogs <= drive.backlogs

  const isEligible = yearOk && branchOk && cgpaOk && backlogsOk

  const failedReasons = []
  if (!yearOk) failedReasons.push(`Year (${studentYear}) not eligible`)
  if (!branchOk) failedReasons.push(`Branch (${profile.branch}) not eligible`)
  if (!cgpaOk) failedReasons.push(`CGPA (${Number(profile.cgpa).toFixed(2)} < ${drive.cgpa})`)
  if (!backlogsOk) failedReasons.push(`Backlogs (${profile.backlogs} > ${drive.backlogs})`)

  return {
    status: isEligible ? 'Eligible' : 'Not Eligible',
    reason: isEligible
      ? 'You meet all academic year, branch, CGPA, and backlog criteria for this drive.'
      : `Criteria unmet: ${failedReasons.join(', ')}.`,
    isEligible,
    checks: {
      year: { ok: yearOk, missing: false, expected: eligibleYears, actual: studentYear },
      branch: { ok: branchOk, missing: false, expected: drive.branches, actual: profile.branch },
      cgpa: { ok: cgpaOk, missing: false, expected: drive.cgpa, actual: profile.cgpa },
      backlogs: { ok: backlogsOk, missing: false, expected: drive.backlogs, actual: profile.backlogs },
    },
  }
}

function DriveCard({ drive, user, profile }) {
  const isStudent = user?.role === 'Student'
  const eligibility = isStudent ? getEligibilityDetails(drive, profile) : null
  const todayStr = new Date().toISOString().slice(0, 10)
  const isPastVisit = drive.status === 'Closed' || (Boolean(drive.deadline) && drive.deadline < todayStr)

  return (
    <article className={`drive-card ${isPastVisit ? 'past-visit-card' : ''}`}>
      <div className="drive-card-header-bar">
        <span className={`drive-type-badge ${isPastVisit ? 'historical' : 'upcoming'}`}>
          {isPastVisit ? '🏛️ Past Campus Visit' : '🎯 Upcoming Drive'}
        </span>
        {isStudent && (
          <span className={`eligibility-badge ${eligibility.status === 'Eligible' ? 'eligible' : eligibility.status === 'Not Eligible' ? 'not-eligible' : 'unconfirmed'}`}>
            {eligibility.status === 'Eligible' ? '✓ Eligible' : eligibility.status === 'Not Eligible' ? '✕ Not Eligible' : '⚠️ Unconfirmed'}
          </span>
        )}
      </div>

      <div className="drive-card-top">
        <div>
          <p className="company-name">{drive.company}</p>
          <h2>{drive.role}</h2>
        </div>
        <div className="salary">
          <strong>₹{drive.salary.toFixed(1)} LPA</strong>
          <span>CTC</span>
        </div>
      </div>

      <div className="academic-years-tags">
        <span className="years-label">Eligible:</span>
        <div className="years-pills">
          {(drive.eligibleYears || ['Final Year']).map((yr) => (
            <span key={yr} className="year-pill-tag">{yr}</span>
          ))}
        </div>
      </div>

      <div className="eligibility-tags">
        <span>Min CGPA {drive.cgpa}</span>
        <span>Backlogs ≤ {drive.backlogs}</span>
        <span>{drive.branches.join(', ')}</span>
      </div>

      <div className="skill-list" aria-label="Required skills">
        {drive.skills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}
      </div>

      <div className="drive-card-bottom">
        <span className="deadline-label">
          {isPastVisit ? `Concluded (${formatDate(drive.deadline)})` : `Apply by ${formatDate(drive.deadline)}`}
        </span>
        <a className="text-link" href={`/drives/${drive.id}`}>
          {isPastVisit ? 'View criteria & prep ↗' : 'View & apply ↗'}
        </a>
      </div>
    </article>
  )
}

function DriveListing({ driveData, user, profile }) {
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('All branches')
  const [academicYearFilter, setAcademicYearFilter] = useState('All Years')
  const [driveTypeTab, setDriveTypeTab] = useState('all')
  const [sort, setSort] = useState('deadline')
  const [deadline, setDeadline] = useState('')

  const todayStr = new Date().toISOString().slice(0, 10)

  const upcomingDrives = driveData.filter(
    (d) => d.status === 'Open' && (!d.deadline || d.deadline >= todayStr)
  )
  const historicalDrives = driveData.filter(
    (d) => d.status === 'Closed' || (Boolean(d.deadline) && d.deadline < todayStr)
  )

  const visibleDrives = driveData
    .filter((drive) => {
      const isPast = drive.status === 'Closed' || (Boolean(drive.deadline) && drive.deadline < todayStr)
      if (driveTypeTab === 'upcoming' && isPast) return false
      if (driveTypeTab === 'historical' && !isPast) return false

      const driveYears = drive.eligibleYears || ['Final Year']
      if (academicYearFilter !== 'All Years' && !driveYears.includes(academicYearFilter)) {
        return false
      }

      const searchText = `${drive.company} ${drive.role} ${drive.skills.join(' ')} ${driveYears.join(' ')}`.toLowerCase()
      return (
        searchText.includes(query.toLowerCase()) &&
        (branch === 'All branches' || drive.branches.includes(branch)) &&
        (!deadline || drive.deadline <= deadline)
      )
    })
    .sort((first, second) => {
      if (sort === 'salary-high') return second.salary - first.salary
      if (sort === 'salary-low') return first.salary - second.salary
      if (sort === 'company') return first.company.localeCompare(second.company)
      return first.deadline.localeCompare(second.deadline)
    })

  return (
    <main className="page-content">
      <section className="hero-panel college-awareness-hero">
        <div className="hero-content">
          <p className="eyebrow">CareerBridge AI <span>·</span> College-Wide Placement Awareness</p>
          <h1>Placement season, decoded for all years.</h1>
          <p className="hero-copy">
            Explore confirmed upcoming recruitment drives and historical campus visits from first year through final year.
            Review eligibility gates, company criteria, required skills, and preparation roadmaps.
          </p>
          <div className="hero-stats">
            <span>{upcomingDrives.length} upcoming drives</span>
            <span>{historicalDrives.length} past campus visits</span>
            <span>{new Set(driveData.map((d) => d.company)).size} companies</span>
            <span>Top CTC {driveData.length ? `₹${Math.max(...driveData.map((d) => d.salary)).toFixed(1)} LPA` : '—'}</span>
          </div>
          <div className="hero-action-links" style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a className="secondary-button" href="/placement-stats" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              📊 View Campus Placement Statistics &amp; Visual Analytics ↗
            </a>
          </div>
        </div>
      </section>

      <section className="drive-browser" aria-label="Placement drives">
        <div className="drive-type-tab-row">
          <button
            type="button"
            className={`tab-btn ${driveTypeTab === 'all' ? 'active' : ''}`}
            onClick={() => setDriveTypeTab('all')}
          >
            All Opportunities ({driveData.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${driveTypeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setDriveTypeTab('upcoming')}
          >
            🎯 Confirmed Upcoming Drives ({upcomingDrives.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${driveTypeTab === 'historical' ? 'active' : ''}`}
            onClick={() => setDriveTypeTab('historical')}
          >
            🏛️ Past Campus Visits &amp; Records ({historicalDrives.length})
          </button>
        </div>

        <label className="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, role, skills, or academic year" aria-label="Search company or role" />
        </label>

        <div className="filter-block">
          <div className="filter-group">
            <span className="filter-group-label">Academic Year:</span>
            <div className="year-filters" role="group" aria-label="Filter by academic year">
              {['All Years', ...ACADEMIC_YEARS].map((yr) => (
                <button
                  type="button"
                  key={yr}
                  className={`year-chip ${academicYearFilter === yr ? 'selected' : ''}`}
                  onClick={() => setAcademicYearFilter(yr)}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Branch:</span>
            <div className="branch-filters" role="group" aria-label="Filter by branch">
              {branches.map((item) => (
                <button className={branch === item ? 'branch-chip selected' : 'branch-chip'} key={item} onClick={() => setBranch(item)} type="button">{item}</button>
              ))}
            </div>
          </div>

          <div className="sort-date-controls">
            <label className="select-wrap">
              <span className="sr-only">Sort drives</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="deadline">Closing soonest</option>
                <option value="salary-high">Highest CTC</option>
                <option value="salary-low">Lowest CTC</option>
                <option value="company">Company A–Z</option>
              </select>
            </label>
            <label className="sr-only" htmlFor="deadline-filter">Apply by date</label>
            <input id="deadline-filter" className="date-filter" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </div>
        </div>

        <div className="drive-list">
          {visibleDrives.length ? (
            visibleDrives.map((drive) => (
              <DriveCard drive={drive} user={user} profile={profile} key={drive.id} />
            ))
          ) : (
            <div className="empty-state">
              <span className="empty-icon">⌕</span>
              <h2>{driveData.length ? 'No drives match your filters' : 'No drives recorded yet'}</h2>
              <p>{driveData.length ? 'Try selecting another academic year, branch, or clear filters.' : 'Placement drives will appear here after a T&P officer publishes them.'}</p>
              {driveData.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setBranch('All branches')
                    setAcademicYearFilter('All Years')
                    setDriveTypeTab('all')
                    setDeadline('')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function DriveDetail({ drive, user, profile, isApplied, onApply }) {
  const isStudent = user?.role === 'Student'
  const eligibility = isStudent ? getEligibilityDetails(drive, profile) : null
  const todayStr = new Date().toISOString().slice(0, 10)
  const isPastVisit = drive.status === 'Closed' || (Boolean(drive.deadline) && drive.deadline < todayStr)

  return (
    <main className="detail-content">
      <a className="back-link" href="/">← <span>All drives</span></a>
      <article className="detail-card">
        <div className="drive-awareness-banner">
          {isPastVisit ? (
            <div className="banner-tag historical">
              <span>🏛️ Campus Visit Archive &amp; Past Recruitment Record</span>
              <small>This drive has concluded. Students from all academic years can review criteria, skills, and preparation roadmaps.</small>
            </div>
          ) : (
            <div className="banner-tag upcoming">
              <span>🎯 Confirmed Upcoming Placement Drive</span>
              <small>Active campus hiring drive for eligible academic years and branches.</small>
            </div>
          )}
        </div>

        <div className="detail-heading">
          <div>
            <p className="company-name">{drive.company}</p>
            <h1>{drive.role}</h1>
          </div>
          <div className="detail-compensation">
            <span className={`status-pill ${drive.status.toLowerCase()}`}>{drive.status}</span>
            <strong>₹{drive.salary.toFixed(1)} LPA</strong>
          </div>
        </div>

        {isStudent && (
          <div className="eligibility-eval-panel">
            <div className="eval-top">
              <div>
                <p className="section-label">Your Eligibility Status</p>
                <div className="eval-status-display">
                  <span className={`eligibility-badge ${eligibility.status === 'Eligible' ? 'eligible' : eligibility.status === 'Not Eligible' ? 'not-eligible' : 'unconfirmed'}`}>
                    {eligibility.status === 'Eligible' ? '✓ Eligible' : eligibility.status === 'Not Eligible' ? '✕ Not Eligible' : '⚠️ Eligibility Unconfirmed'}
                  </span>
                  <span className="eval-reason">{eligibility.reason}</span>
                </div>
              </div>
              {eligibility.status === 'Eligibility Unconfirmed' && (
                <a className="primary-button compact-button" href="/student">
                  Update Profile Academic Year ↗
                </a>
              )}
            </div>

            {eligibility.checks && (
              <div className="eligibility-checklist-grid">
                <div className={`check-card ${eligibility.checks.year.ok ? 'pass' : eligibility.checks.year.missing ? 'warn' : 'fail'}`}>
                  <span className="check-icon">{eligibility.checks.year.ok ? '✓' : eligibility.checks.year.missing ? '⚠️' : '✕'}</span>
                  <div className="check-info">
                    <strong>Academic Year</strong>
                    <span className="check-required">Required: {(drive.eligibleYears || ['Final Year']).join(', ')}</span>
                    <span className="check-actual">Your Year: {eligibility.checks.year.actual}</span>
                  </div>
                </div>

                <div className={`check-card ${eligibility.checks.branch.ok ? 'pass' : eligibility.checks.branch.missing ? 'warn' : 'fail'}`}>
                  <span className="check-icon">{eligibility.checks.branch.ok ? '✓' : eligibility.checks.branch.missing ? '⚠️' : '✕'}</span>
                  <div className="check-info">
                    <strong>Branch</strong>
                    <span className="check-required">Allowed: {drive.branches.join(', ')}</span>
                    <span className="check-actual">Your Branch: {eligibility.checks.branch.actual}</span>
                  </div>
                </div>

                <div className={`check-card ${eligibility.checks.cgpa.ok ? 'pass' : eligibility.checks.cgpa.missing ? 'warn' : 'fail'}`}>
                  <span className="check-icon">{eligibility.checks.cgpa.ok ? '✓' : eligibility.checks.cgpa.missing ? '⚠️' : '✕'}</span>
                  <div className="check-info">
                    <strong>Minimum CGPA</strong>
                    <span className="check-required">Cutoff: {drive.cgpa} / 10.0</span>
                    <span className="check-actual">Your CGPA: {typeof eligibility.checks.cgpa.actual === 'number' ? Number(eligibility.checks.cgpa.actual).toFixed(2) : 'Not set'}</span>
                  </div>
                </div>

                <div className={`check-card ${eligibility.checks.backlogs.ok ? 'pass' : eligibility.checks.backlogs.missing ? 'warn' : 'fail'}`}>
                  <span className="check-icon">{eligibility.checks.backlogs.ok ? '✓' : eligibility.checks.backlogs.missing ? '⚠️' : '✕'}</span>
                  <div className="check-info">
                    <strong>Backlog Rule</strong>
                    <span className="check-required">Max: {drive.backlogs} backlogs</span>
                    <span className="check-actual">Your Backlogs: {eligibility.checks.backlogs.actual}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="detail-facts">
          <div><span>Eligible Years</span><strong className="fact-highlight">{(drive.eligibleYears || ['Final Year']).join(', ')}</strong></div>
          <div><span>Eligible Branches</span><strong>{drive.branches.join(', ')}</strong></div>
          <div><span>Min CGPA</span><strong>{drive.cgpa} / 10</strong></div>
          <div><span>Max backlogs</span><strong>{drive.backlogs}</strong></div>
          <div><span>Apply by</span><strong>{formatDate(drive.deadline)}</strong></div>
          <div><span>Drive Status</span><strong>{drive.status}</strong></div>
        </div>

        <section className="detail-section">
          <h3>Role description</h3>
          <p className="detail-description">{drive.description}</p>
        </section>

        <SkillSection title="Required skills" skills={drive.skills} />
        <SkillSection title="Preferred skills" skills={drive.preferred} tone="green" />
        <SkillSection title="JD keywords" skills={drive.keywords} tone="neutral" />

        <section className="selection-process-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow-dark">PREPARATION &amp; SELECTION GUIDANCE</p>
              <h3>Selection Process &amp; Preparation Roadmap</h3>
            </div>
            <a className="text-link" href="/placement-stats">View Placement Statistics 📊</a>
          </div>
          <p className="process-intro">Students from first year through final year can use this preparation overview to get ready for hiring rounds with {drive.company}.</p>

          <div className="process-stages-grid">
            <div className="process-stage">
              <span className="stage-num">01</span>
              <h4>Online Assessment (OA)</h4>
              <p>Aptitude, quantitative reasoning, and programming challenges evaluating core problem solving and speed.</p>
              <div className="stage-skills">
                <span className="mini-tag">Aptitude</span>
                <span className="mini-tag">Data Structures</span>
                <span className="mini-tag">Algorithms</span>
              </div>
            </div>

            <div className="process-stage">
              <span className="stage-num">02</span>
              <h4>Technical Interview</h4>
              <p>Live coding, system architecture, database design, and deep-dive into verified academic projects and skills.</p>
              <div className="stage-skills">
                <span className="mini-tag">Problem Solving</span>
                <span className="mini-tag">Core CS</span>
                <span className="mini-tag">Projects</span>
              </div>
            </div>

            <div className="process-stage">
              <span className="stage-num">03</span>
              <h4>HR &amp; Leadership Round</h4>
              <p>Behavioral assessment, workplace values, cultural alignment, and career aspirations discussion.</p>
              <div className="stage-skills">
                <span className="mini-tag">Communication</span>
                <span className="mini-tag">Behavioral</span>
                <span className="mini-tag">Teamwork</span>
              </div>
            </div>
          </div>
        </section>

        {isStudent && (
          <div className="apply-row">
            <div>
              {isApplied ? (
                <span className="apply-status-text">Your application is in the review queue. Match scores are transparently recorded.</span>
              ) : isPastVisit ? (
                <span className="apply-status-text muted">This campus drive has concluded. Application submissions are closed.</span>
              ) : eligibility.status === 'Eligibility Unconfirmed' ? (
                <span className="apply-status-text text-warning">Academic year is required before applying. Please update your profile.</span>
              ) : eligibility.isEligible ? (
                <span className="apply-status-text text-success">You meet all eligibility criteria for this drive.</span>
              ) : (
                <span className="apply-status-text text-danger">{eligibility.reason}</span>
              )}
            </div>

            <button
              className="primary-button apply-button"
              disabled={isApplied || isPastVisit || !eligibility.isEligible}
              onClick={() => onApply(drive)}
              type="button"
            >
              {isApplied
                ? 'Applied'
                : isPastVisit
                  ? 'Drive Concluded'
                  : eligibility.status === 'Eligibility Unconfirmed'
                    ? 'Eligibility Unconfirmed'
                    : eligibility.isEligible
                      ? 'Apply to this drive'
                      : 'Not eligible to apply'}
            </button>
          </div>
        )}

        {!user && (
          <div className="guest-awareness-row">
            <p>Students from 1st Year to Final Year can sign in to view personal eligibility gates, submit applications, and track opportunities.</p>
            <a className="primary-button compact-button" href="/login">Sign in to check eligibility</a>
          </div>
        )}
      </article>
    </main>
  )
}

function SkillSection({ title, skills, tone = 'blue' }) {
  return (
    <section className="detail-skill-section">
      <p className="section-label">{title}</p>
      <div className={`skill-list ${tone}`}>
        {skills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}
      </div>
    </section>
  )
}

function SemesterGpaModal({ currentSemGpa = {}, onClose, onSave }) {
  const [semValues, setSemValues] = useState(() => {
    const initial = {}
    for (let i = 1; i <= 8; i++) {
      initial[i] = currentSemGpa[i] !== undefined && currentSemGpa[i] !== null ? String(currentSemGpa[i]) : ''
    }
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  let total = 0
  let count = 0
  for (let i = 1; i <= 8; i++) {
    const val = semValues[i]
    if (val !== '' && !isNaN(val)) {
      const num = Number(val)
      if (num >= 0 && num <= 10) {
        total += num
        count++
      }
    }
  }
  const computedCgpa = count > 0 ? (total / count).toFixed(2) : null

  function handleChange(sem, val) {
    setSemValues((prev) => ({ ...prev, [sem]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {}
      for (let i = 1; i <= 8; i++) {
        const val = semValues[i]
        if (val !== '' && !isNaN(val)) {
          const num = Number(val)
          if (num < 0 || num > 10) {
            throw new Error(`Semester ${i} GPA must be between 0 and 10.`)
          }
          payload[i] = num
        }
      }
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="sem-modal-backdrop" onClick={onClose} role="presentation">
      <div className="sem-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="sem-modal-header">
          <div>
            <p className="eyebrow-dark">ACADEMIC RECORD</p>
            <h2>Update Semester-wise CGPA</h2>
          </div>
          <button aria-label="Close modal" className="quiet-button" onClick={onClose} type="button">✕</button>
        </header>

        <p className="sem-modal-intro">
          Enter the SGPA/CGPA numbers for each completed semester. The cumulative CGPA will be automatically updated as the average.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="sem-inputs-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <div key={sem} className="sem-input-group">
                <label htmlFor={`sem-input-${sem}`}>Semester {sem} SGPA</label>
                <input
                  id={`sem-input-${sem}`}
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  placeholder="e.g. 8.50"
                  value={semValues[sem]}
                  onChange={(e) => handleChange(sem, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="sem-summary-box">
            <span>Calculated Cumulative CGPA</span>
            <strong>
              {computedCgpa !== null ? `${computedCgpa} / 10.0` : 'Not entered'}
            </strong>
          </div>

          {error && <p className="form-error" role="alert" style={{ marginBottom: '14px' }}>{error}</p>}

          <div className="sem-modal-actions">
            <button className="quiet-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button compact-button" disabled={saving} type="submit">
              {saving ? 'Saving…' : 'Save Semester GPAs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StudentDashboard({ profile, resume, scorecard, certificates = [], onSaveProfile, onSaveResume, onViewResume, onSaveScorecard, onViewScorecard, onUpdateSemGpa, onCreateCertificate, onUpdateCertificate, onDeleteCertificate, onViewCertificate, applications: applicationData }) {
  const [editing, setEditing] = useState(false)
  const [selectedResume, setSelectedResume] = useState(null)
  const [resumeError, setResumeError] = useState('')
  const [notice, setNotice] = useState('')
  const [showSemModal, setShowSemModal] = useState(false)
  const [selectedScorecard, setSelectedScorecard] = useState(null)
  const [scorecardError, setScorecardError] = useState('')
  const [replacingScorecard, setReplacingScorecard] = useState(false)
  const [showCertificateForm, setShowCertificateForm] = useState(false)
  const [certificateForm, setCertificateForm] = useState({
    name: '',
    issuer: '',
    issueDate: '',
    credentialId: '',
    credentialUrl: '',
    description: '',
  })
  const [certificateFile, setCertificateFile] = useState(null)
  const [certificateError, setCertificateError] = useState('')
  const [editingCertificateId, setEditingCertificateId] = useState(null)
  const applications = applicationData.map((application) => ({
    ...application,
    score: { ...application.scoreBreakdown, score: application.score },
    applied: formatDate(application.appliedAt),
  }))

  function resetCertificateForm() {
    setShowCertificateForm(false)
    setEditingCertificateId(null)
    setCertificateForm({ name: '', issuer: '', issueDate: '', credentialId: '', credentialUrl: '', description: '' })
    setCertificateFile(null)
    setCertificateError('')
  }

  function startCreateCertificate() {
    setEditingCertificateId(null)
    setCertificateForm({ name: '', issuer: '', issueDate: '', credentialId: '', credentialUrl: '', description: '' })
    setCertificateFile(null)
    setCertificateError('')
    setShowCertificateForm(true)
  }

  function startEditCertificate(certificate) {
    setEditingCertificateId(certificate.id)
    setCertificateForm({
      name: certificate.name,
      issuer: certificate.issuer,
      issueDate: certificate.issueDate,
      credentialId: certificate.credentialId || '',
      credentialUrl: certificate.credentialUrl || '',
      description: certificate.description || '',
    })
    setCertificateFile(null)
    setCertificateError('')
    setShowCertificateForm(true)
  }

  function handleCertificateFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png']
    const validExt = ['.pdf', '.jpg', '.jpeg', '.png']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!validTypes.includes(file.type) && !validExt.includes(extension)) {
      setCertificateError('Use a PDF, JPG, JPEG, or PNG certificate file.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setCertificateError('Certificate file must be 5 MB or smaller.')
      event.target.value = ''
      return
    }
    setCertificateError('')
    setCertificateFile(file)
  }

  async function submitCertificate(event) {
    event.preventDefault()
    const payload = new FormData()
    payload.append('name', certificateForm.name)
    payload.append('issuer', certificateForm.issuer)
    payload.append('issueDate', certificateForm.issueDate)
    payload.append('credentialId', certificateForm.credentialId)
    payload.append('credentialUrl', certificateForm.credentialUrl)
    payload.append('description', certificateForm.description)
    if (certificateFile) payload.append('certificate', certificateFile)

    try {
      if (editingCertificateId) {
        await onUpdateCertificate(editingCertificateId, payload)
        setNotice('Certificate updated.')
      } else {
        await onCreateCertificate(payload)
        setNotice('Certificate added.')
      }
      resetCertificateForm()
    } catch (error) {
      setCertificateError(error.message)
    }
  }

  async function removeCertificate(id) {
    if (!window.confirm('Delete this certificate?')) return
    try {
      await onDeleteCertificate(id)
      setNotice('Certificate removed.')
      if (editingCertificateId === id) resetCertificateForm()
    } catch (error) {
      setCertificateError(error.message)
    }
  }

  function saveProfile(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    onSaveProfile({
      ...profile,
      name: fields.get('name'),
      branch: fields.get('branch'),
      academicYear: fields.get('academicYear') || '',
      cgpa: Number(fields.get('cgpa')),
      backlogs: Number(fields.get('backlogs')),
      certifications: Number(fields.get('certifications')),
      skills: fields.get('skills').split(',').map((skill) => skill.trim()).filter(Boolean),
    })
      .then(() => {
        setEditing(false)
        setNotice('Profile updated.')
      })
      .catch((error) => setNotice(error.message))
  }

  function selectResume(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') || file.type && file.type !== 'application/pdf') {
      setResumeError('Choose a PDF resume.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setResumeError('Resume must be 2 MB or smaller.')
      return
    }
    setSelectedResume(file)
    setResumeError('')
    setNotice('')
  }

  async function uploadResume() {
    if (!selectedResume) return
    try {
      await onSaveResume(selectedResume)
      setSelectedResume(null)
      setNotice('Resume uploaded. T&P officers can view it from your applications.')
    } catch (error) {
      setResumeError(error.message)
    }
  }

  function selectScorecard(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
      setScorecardError('Choose a consolidated PDF scorecard.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setScorecardError('Scorecard must be 10 MB or smaller.')
      return
    }
    setSelectedScorecard(file)
    setScorecardError('')
    setNotice('')
  }

  async function uploadScorecard() {
    if (!selectedScorecard) return
    try {
      await onSaveScorecard(selectedScorecard)
      setSelectedScorecard(null)
      setReplacingScorecard(false)
      setNotice('All-semesters scorecard PDF uploaded successfully.')
    } catch (error) {
      setScorecardError(error.message)
    }
  }

  return (
    <main className="workspace-content">
      {notice && <div className="inline-notice" style={{ marginBottom: '18px' }}>{notice}</div>}
      {!profile.academicYear && (
        <div className="warning-banner" role="alert" style={{ marginBottom: '18px', padding: '14px 18px', background: 'var(--warning-subtle)', border: '1px solid var(--warning)', borderRadius: '8px', color: 'var(--text)' }}>
          <strong>⚠️ Academic Year Required:</strong> Your eligibility for all placement drives is currently marked as <strong>Eligibility Unconfirmed</strong>. Please click "Edit profile" below to select your current academic year (First Year, Second Year, Third Year, or Final Year) so you can apply to drives.
        </div>
      )}
      <div className="workspace-heading">
        <div>
          <p className="eyebrow-dark">STUDENT WORKSPACE</p>
          <h1>Hi {profile.name}</h1>
          <p>Keep your profile accurate: every score and eligibility gate reads from it.</p>
        </div>
      </div>
      <div className="metric-grid four-metrics">
        <Metric label="CGPA" value={Number(profile.cgpa).toFixed(2)} />
        <Metric label="Active backlogs" value={profile.backlogs} />
        <Metric label="Certificates" value={certificates.length} />
        <Metric label="Applications" value={applications.length} />
      </div>

      <div className="student-tools-grid">
        <section className="workspace-panel profile-panel">
          <div className="panel-heading">
            <div><h2>Profile</h2><p>{resume ? `Resume: ${resume.name}` : 'No resume uploaded yet'}</p></div>
            <button className="quiet-button" onClick={() => setEditing(!editing)} type="button">{editing ? 'Cancel' : 'Edit profile'}</button>
          </div>
          {editing ? (
            <form className="profile-edit-form" onSubmit={saveProfile}>
              <label>Full name<input defaultValue={profile.name} name="name" required /></label>
              <div className="form-grid-two">
                <label>Branch<select defaultValue={profile.branch} name="branch">{branches.slice(1).map((branch) => <option key={branch}>{branch}</option>)}</select></label>
                <label>Academic Year
                  <select defaultValue={profile.academicYear || ''} name="academicYear" required>
                    <option value="" disabled>Select Academic Year</option>
                    {ACADEMIC_YEARS.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </label>
                <label>CGPA<input defaultValue={profile.cgpa} max="10" min="0" name="cgpa" required step="0.01" type="number" /></label>
                <label>Active backlogs<input defaultValue={profile.backlogs} min="0" name="backlogs" required type="number" /></label>
                <label>Certifications<input defaultValue={profile.certifications} min="0" name="certifications" required type="number" /></label>
              </div>
              <label>Skills, separated by commas<textarea defaultValue={profile.skills.join(', ')} name="skills" rows="3" /></label>
              <button className="primary-button compact-button" type="submit">Save profile</button>
            </form>
          ) : (
            <>
              <dl className="profile-facts">
                <div><dt>Branch</dt><dd>{profile.branch}</dd></div>
                <div>
                  <dt>Academic Year</dt>
                  <dd>
                    {profile.academicYear ? (
                      <strong>{profile.academicYear}</strong>
                    ) : (
                      <span className="unconfirmed-badge" style={{ color: 'var(--warning)', fontWeight: 600 }}>⚠️ Not Set (Unconfirmed)</span>
                    )}
                  </dd>
                </div>
                <div><dt>CGPA</dt><dd>{Number(profile.cgpa).toFixed(2)} / 10.0</dd></div>
                <div><dt>Backlogs</dt><dd>{profile.backlogs}</dd></div>
                <div><dt>Certificates</dt><dd>{certificates.length}</dd></div>
              </dl>

              <div className="sem-gpa-container">
                <div className="sem-gpa-header">
                  <div>
                    <h3>Semester-wise CGPA</h3>
                  </div>
                  <button className="quiet-button" onClick={() => setShowSemModal(true)} type="button" style={{ fontSize: '12px', minHeight: '30px', padding: '4px 10px' }}>
                    ✏️ Update sem-wise numbers
                  </button>
                </div>
                {profile.semGpa && Object.keys(profile.semGpa).filter((k) => profile.semGpa[k] !== undefined && profile.semGpa[k] !== null).length > 0 ? (
                  <div className="sem-gpa-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      profile.semGpa[sem] !== undefined && profile.semGpa[sem] !== null ? (
                        <div className="sem-chip" key={sem}>
                          <span className="sem-chip-num">Sem {sem}</span>
                          <span className="sem-chip-val">{Number(profile.semGpa[sem]).toFixed(2)}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                ) : (
                  <p className="sem-gpa-empty">No semester marks recorded yet. Click 'Update sem-wise numbers' to add your semester GPAs.</p>
                )}
              </div>

              <div className="scorecard-verification-card">
                <div className="card-top">
                  <div>
                    <h3>All-Semesters Scorecard (PDF Verification)</h3>
                    <p className="subtitle">Upload a single PDF of all semester scorecards to verify your CGPA.</p>
                  </div>
                  {scorecard && !replacingScorecard && (
                    <span className="status-pill selected" style={{ fontSize: '11px', padding: '3px 8px' }}>
                      ✓ Attached
                    </span>
                  )}
                </div>

                {scorecard && !replacingScorecard ? (
                  <div className="scorecard-file-row">
                    <div className="scorecard-file-info">
                      <span className="file-icon" aria-hidden="true">📄</span>
                      <div className="scorecard-file-details">
                        <strong title={scorecard.name}>{scorecard.name}</strong>
                        <small>Uploaded {formatDate(scorecard.uploadedAt)} · {(scorecard.size / 1024).toFixed(1)} KB</small>
                      </div>
                    </div>
                    <div className="scorecard-actions">
                      <button className="primary-button compact-button" onClick={onViewScorecard} type="button">
                        View scorecard PDF ↗
                      </button>
                      <button className="quiet-button" onClick={() => setReplacingScorecard(true)} type="button">
                        Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="scorecard-upload-area">
                    <label className="upload-zone">
                      <input accept="application/pdf,.pdf" onChange={selectScorecard} type="file" />
                      <span className="upload-symbol" aria-hidden="true">↑</span>
                      <span>{selectedScorecard?.name || 'Choose consolidated PDF scorecard'}</span>
                      <small>{selectedScorecard ? 'Ready to upload' : 'Single PDF with all sem marksheets (up to 10 MB)'}</small>
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button className="primary-button compact-button" disabled={!selectedScorecard} onClick={uploadScorecard} type="button">
                        Upload scorecard PDF
                      </button>
                      {replacingScorecard && (
                        <button className="quiet-button" onClick={() => { setReplacingScorecard(false); setSelectedScorecard(null); }} type="button">
                          Cancel
                        </button>
                      )}
                    </div>
                    {scorecardError && <p className="form-error" role="alert" style={{ marginTop: '8px' }}>{scorecardError}</p>}
                  </div>
                )}
              </div>

              <p className="section-label" style={{ marginTop: '20px' }}>Skills</p>
              <div className="skill-list">{profile.skills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}</div>
            </>
          )}
        </section>

        <section className="workspace-panel resume-panel">
          <div className="panel-heading"><div><h2>Resume</h2><p>{resume ? `Current file: ${resume.name}` : 'Upload a PDF to share it with T&P officers when you apply.'}</p></div></div>
          <label className="upload-zone">
            <input accept="application/pdf,.pdf" onChange={selectResume} type="file" />
            <span className="upload-symbol" aria-hidden="true">↑</span>
            <span>{selectedResume?.name || resume?.name || 'Choose a PDF resume'}</span>
            <small>{selectedResume ? 'Ready to upload' : 'PDF files up to 2 MB'}</small>
          </label>
          <button className="primary-button compact-button" disabled={!selectedResume} onClick={uploadResume} type="button">Upload resume</button>
          {resumeError && <p className="form-error" role="alert">{resumeError}</p>}
          {resume && <button className="text-link current-resume-link" onClick={onViewResume} type="button">View current resume ↗</button>}
          <p className="sample-resumes">PDF only, up to 2 MB. T&amp;P officers can view your uploaded resume from each application.</p>
        </section>
      </div>

      <section className="workspace-panel certificate-panel">
        <div className="panel-heading">
          <div>
            <h2>Certificates</h2>
            <p>{certificates.length ? `${certificates.length} credential${certificates.length > 1 ? 's' : ''} saved.` : 'Add course completions, professional certifications, and achievements.'}</p>
          </div>
          {!showCertificateForm && <button className="quiet-button" onClick={startCreateCertificate} type="button">Add certificate</button>}
        </div>

        {showCertificateForm && (
          <form className="certificate-form" onSubmit={submitCertificate}>
            <div className="form-grid-two">
              <label>Certificate name<input value={certificateForm.name} onChange={(event) => setCertificateForm((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label>Issuer<input value={certificateForm.issuer} onChange={(event) => setCertificateForm((current) => ({ ...current, issuer: event.target.value }))} required /></label>
              <label>Issue date<input type="date" value={certificateForm.issueDate} onChange={(event) => setCertificateForm((current) => ({ ...current, issueDate: event.target.value }))} required /></label>
              <label>Credential ID<input value={certificateForm.credentialId} onChange={(event) => setCertificateForm((current) => ({ ...current, credentialId: event.target.value }))} /></label>
              <label className="full-span">Credential URL<input type="url" value={certificateForm.credentialUrl} onChange={(event) => setCertificateForm((current) => ({ ...current, credentialUrl: event.target.value }))} placeholder="https://example.com/credential" /></label>
            </div>
            <label>Description<textarea rows="4" value={certificateForm.description} onChange={(event) => setCertificateForm((current) => ({ ...current, description: event.target.value }))} placeholder="Briefly describe what this certificate covers." /></label>
            <label className="upload-zone certificate-upload-zone">
              <input accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf" onChange={handleCertificateFileChange} type="file" />
              <span className="upload-symbol" aria-hidden="true">↑</span>
              <span>{certificateFile?.name || 'Upload certificate file (optional)'}</span>
              <small>PDF, JPG, JPEG, or PNG up to 5 MB</small>
            </label>
            {certificateError && <p className="form-error" role="alert">{certificateError}</p>}
            <div className="certificate-actions-row">
              <button className="primary-button compact-button" type="submit">{editingCertificateId ? 'Save changes' : 'Add certificate'}</button>
              <button className="quiet-button" onClick={resetCertificateForm} type="button">Cancel</button>
            </div>
          </form>
        )}

        {!showCertificateForm && (certificates.length ? (
          <div className="certificate-list">
            {certificates.map((certificate) => (
              <article className="certificate-card" key={certificate.id}>
                <div className="certificate-header">
                  <div>
                    <p className="company-name">{certificate.issuer}</p>
                    <h3>{certificate.name}</h3>
                  </div>
                  {certificate.hasFile && <button className="text-link" onClick={() => onViewCertificate(certificate.id)} type="button">View file ↗</button>}
                </div>
                <div className="certificate-meta">
                  <span>Issued {formatDate(certificate.issueDate)}</span>
                  {certificate.credentialId && <span>ID: {certificate.credentialId}</span>}
                </div>
                {certificate.credentialUrl && <a className="text-link" href={certificate.credentialUrl} rel="noreferrer" target="_blank">Credential link ↗</a>}
                {certificate.description && <p className="certificate-description">{certificate.description}</p>}
                <div className="certificate-actions-row">
                  <button className="quiet-button" onClick={() => startEditCertificate(certificate)} type="button">Edit</button>
                  <button className="quiet-button danger-button" onClick={() => removeCertificate(certificate.id)} type="button">Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state certificate-empty">
            <h2>No certificates yet</h2>
            <p>Add your training and certification details to strengthen your profile.</p>
          </div>
        ))}
      </section>

      {notice && <p className="inline-notice" role="status">{notice}</p>}

      <section className="applications-section">
        <div className="section-heading-row"><div><p className="eyebrow-dark">YOUR ACTIVITY</p><h2>My applications</h2></div><a className="text-link" href="/">Browse drives ↗</a></div>
        {applications.length ? <div className="application-list">
          {applications.map(({ drive, score, status, applied }) => {
            const eligibility = getEligibilityDetails(drive, profile)
            const missingSkills = drive.skills.filter((skill) => !profile.skills.some((item) => item.toLowerCase() === skill.toLowerCase()))
            return (
              <article className="application-card" key={drive.id}>
                <div className="application-header">
                  <div>
                    <p className="company-name">{drive.company}</p>
                    <h3>{drive.role}</h3>
                    <p className="deadline-label">Applied {applied}</p>
                  </div>
                  <span className={`status-pill ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
                </div>
                <div className="application-score-row">
                  <div><span className="section-label">Match score</span><strong>{score?.score !== undefined ? Number(score.score).toFixed(1) : '28.0'} <small>/ 100</small></strong></div>
                  <span className={`eligibility-badge ${eligibility.status === 'Eligible' ? 'eligible' : eligibility.status === 'Not Eligible' ? 'not-eligible' : 'unconfirmed'}`}>
                    {eligibility.status}
                  </span>
                </div>
                <div className="application-drive-meta" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0 12px' }}>
                  <span className="year-pill-tag">Eligible: {(drive.eligibleYears || ['Final Year']).join(', ')}</span>
                  <span className="year-pill-tag">Min CGPA: {drive.cgpa}</span>
                  <span className="year-pill-tag">Max Backlogs: {drive.backlogs}</span>
                </div>
                <div className="score-grid">
                  <ScoreMetric label="Required skills match" value={score?.required || 0} max="50" matches={score?.requiredMatches || `0 of ${drive.skills.length}`} skills={drive.skills} />
                  <ScoreMetric label="Preferred skills match" value={score?.preferred || 0} max="20" matches={score?.preferredMatches || `0 of ${drive.preferred.length}`} skills={drive.preferred} />
                  <ScoreMetric label="JD keyword coverage" value={score?.keywords || 0} max="15" matches={score?.keywordMatches || `0 of ${drive.keywords.length}`} skills={drive.keywords} />
                  <ScoreMetric label="Profile completeness" value={score?.completeness || 10} max="15" matches={`${profile.certifications} certification(s)`} skills={[]} />
                </div>
                <div className="top-fixes"><strong>Top fixes — ranked by points at stake</strong><p>{missingSkills.length ? `Add ${missingSkills.join(', ')} to your skills or resume to strengthen this match.` : 'Your required skills line up well with this role. Keep your profile current.'}</p><a className="text-link" href={`/drives/${drive.id}`}>Review drive details ↗</a></div>
              </article>
            )
          })}
        </div> : <div className="empty-state application-empty"><h2>No applications yet</h2><p>Your applications and match breakdowns will appear here after you apply to a drive.</p><a className="primary-link" href="/">Explore open drives</a></div>}
      </section>

      {showSemModal && (
        <SemesterGpaModal
          currentSemGpa={profile.semGpa || {}}
          onClose={() => setShowSemModal(false)}
          onSave={async (semGpa) => {
            await onUpdateSemGpa(semGpa)
            setNotice('Semester-wise GPAs updated successfully.')
          }}
        />
      )}
    </main>
  )
}

function Metric({ label, value }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>
}

function ScoreMetric({ label, value, max, matches, skills }) {
  return (
    <div className="score-metric">
      <div className="score-label-row"><span>{label}</span><strong>{Math.round((value / Number(max)) * 100)}%</strong></div>
      <div className="score-track"><span style={{ width: `${Math.max(0, Math.min(100, (value / Number(max)) * 100))}%` }} /></div>
      <div className="score-value-row"><span>{Number(value).toFixed(1)} / {max}</span><span>{matches}</span></div>
      {skills.length > 0 && <div className="skill-list score-skills">{skills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}</div>}
    </div>
  )
}

function CertificateViewerModal({ activeCertificate, onClose, onDownload }) {
  if (!activeCertificate) return null
  const isImage = activeCertificate.isImage || /\.(png|jpe?g)$/i.test(activeCertificate.fileName || '') || (activeCertificate.fileType && activeCertificate.fileType.includes('image'))

  return (
    <div className="resume-viewer-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-label={`${activeCertificate.name} certificate`}
        aria-modal="true"
        className="resume-viewer-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div>
            <p className="eyebrow-dark">STUDENT CERTIFICATE</p>
            <h2>{activeCertificate.name} — <small>{activeCertificate.issuer}</small></h2>
          </div>
          <div className="modal-header-actions">
            {onDownload && (
              <button
                className="primary-button compact-button"
                onClick={() => onDownload(activeCertificate)}
                type="button"
              >
                Download
              </button>
            )}
            <button
              aria-label="Close certificate viewer"
              className="quiet-button"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </header>
        {isImage ? (
          <div className="certificate-image-wrap">
            <img src={activeCertificate.url} alt={`${activeCertificate.name} certificate document`} />
          </div>
        ) : (
          <iframe src={activeCertificate.url} title={`${activeCertificate.name} certificate PDF`} />
        )}
      </section>
    </div>
  )
}

function TPStudentDetails({ student, onViewCertificate, onDownloadCertificate, onViewResume, onDownloadResume, onViewScorecard, onDownloadScorecard }) {
  const certCount = student.certificates ? student.certificates.length : 0

  return (
    <main className="workspace-content tp-student-page">
      <a className="back-link" href="/tp">← <span>T&amp;P Center</span></a>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow-dark">STUDENT PROFILE</p>
          <h1>Student: {student.name}</h1>
          <p>{student.email} · {student.branch} · Placement &amp; verified credential records</p>
        </div>
      </div>

      <div className="metric-grid four-metrics tp-student-metrics">
        <Metric label="Branch" value={student.branch} />
        <Metric label="CGPA" value={Number(student.cgpa).toFixed(2)} />
        <Metric label="Backlogs" value={student.backlogs} />
        <Metric label="Certificates" value={certCount} />
      </div>

      <div className="student-tools-grid">
        <section className="workspace-panel profile-panel">
          <div className="panel-heading">
            <div>
              <h2>Profile overview</h2>
              <p>Academic gates &amp; student skills</p>
            </div>
          </div>
          <dl className="profile-facts">
            <div><dt>Full name</dt><dd>{student.name}</dd></div>
            <div><dt>Email</dt><dd>{student.email}</dd></div>
            <div><dt>Branch</dt><dd>{student.branch}</dd></div>
            <div><dt>CGPA</dt><dd>{Number(student.cgpa).toFixed(2)} / 10.0</dd></div>
            <div><dt>Active backlogs</dt><dd>{student.backlogs}</dd></div>
            <div><dt>Scorecard</dt><dd>{student.hasScorecard ? <span style={{ color: 'var(--success)' }}>✓ Uploaded</span> : <span className="resume-missing">Not uploaded</span>}</dd></div>
            <div><dt>Certificates</dt><dd>{certCount}</dd></div>
          </dl>

          {student.semGpa && Object.keys(student.semGpa).filter((k) => student.semGpa[k] !== undefined && student.semGpa[k] !== null).length > 0 && (
            <div className="sem-gpa-container" style={{ margin: '14px 0' }}>
              <div className="sem-gpa-header">
                <h3>Semester-wise GPAs</h3>
              </div>
              <div className="sem-gpa-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  student.semGpa[sem] !== undefined && student.semGpa[sem] !== null ? (
                    <div className="sem-chip" key={sem}>
                      <span className="sem-chip-num">Sem {sem}</span>
                      <span className="sem-chip-val">{Number(student.semGpa[sem]).toFixed(2)}</span>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}

          <p className="section-label">Skills</p>
          <div className="skill-list">
            {student.skills && student.skills.length > 0 ? (
              student.skills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)
            ) : (
              <span className="resume-missing">No skills tagged</span>
            )}
          </div>
        </section>

        <section className="workspace-panel resume-panel">
          <div className="panel-heading">
            <div>
              <h2>Student resume</h2>
              <p>{student.resume ? `Current file: ${student.resume.name}` : 'No resume uploaded by this student'}</p>
            </div>
          </div>
          {student.resume ? (
            <div style={{ display: 'grid', gap: '14px', marginTop: '12px' }}>
              <div className="resume-info-card">
                <span className="upload-symbol" aria-hidden="true">📄</span>
                <div>
                  <strong>{student.resume.name}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)', marginTop: '2px' }}>
                    Uploaded {formatDate(student.resume.uploadedAt)} · {(student.resume.size / 1024).toFixed(1)} KB
                  </small>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="primary-button compact-button" onClick={onViewResume} type="button">
                  View resume PDF ↗
                </button>
                <button className="quiet-button" onClick={onDownloadResume} type="button">
                  Download
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>No resume uploaded by this student yet.</p>
            </div>
          )}

          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="panel-heading" style={{ marginBottom: '12px' }}>
              <div>
                <h2>All-Sem Scorecard</h2>
                <p>{student.scorecard ? `Current file: ${student.scorecard.name}` : 'No scorecard uploaded'}</p>
              </div>
            </div>
            {student.scorecard ? (
              <div style={{ display: 'grid', gap: '14px' }}>
                <div className="resume-info-card">
                  <span className="upload-symbol" aria-hidden="true">📑</span>
                  <div>
                    <strong>{student.scorecard.name}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)', marginTop: '2px' }}>
                      Uploaded {formatDate(student.scorecard.uploadedAt)} · {(student.scorecard.size / 1024).toFixed(1)} KB
                    </small>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button className="primary-button compact-button" onClick={onViewScorecard} type="button">
                    View scorecard PDF ↗
                  </button>
                  <button className="quiet-button" onClick={onDownloadScorecard} type="button">
                    Download
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px' }}>
                <p>No consolidated scorecard PDF uploaded by student yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="workspace-panel tp-certificates-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow-dark">ACADEMIC &amp; PROFESSIONAL CREDENTIALS</p>
            <h2>Student Certificates ({certCount})</h2>
          </div>
        </div>

        {certCount > 0 ? (
          <div className="tp-certificate-list">
            {student.certificates.map((cert, index) => (
              <article className="tp-certificate-card" key={cert.id}>
                <div className="tp-certificate-top">
                  <div className="tp-cert-badge">Certificate {index + 1}</div>
                  <div className="tp-cert-meta-tags">
                    <span className="tp-cert-date">Issue Date: {formatDate(cert.issueDate)}</span>
                  </div>
                </div>

                <div className="tp-certificate-body">
                  <div className="tp-cert-field">
                    <span className="tp-field-label">Name:</span>
                    <strong className="tp-field-value">{cert.name}</strong>
                  </div>
                  <div className="tp-cert-field">
                    <span className="tp-field-label">Issuer:</span>
                    <span className="tp-field-value">{cert.issuer}</span>
                  </div>
                  <div className="tp-cert-field">
                    <span className="tp-field-label">Issue Date:</span>
                    <span className="tp-field-value">{formatDate(cert.issueDate)}</span>
                  </div>
                  {cert.credentialId ? (
                    <div className="tp-cert-field">
                      <span className="tp-field-label">Credential ID:</span>
                      <span className="tp-field-value tp-mono">{cert.credentialId}</span>
                    </div>
                  ) : null}
                  {cert.description ? (
                    <div className="tp-cert-field tp-cert-desc">
                      <span className="tp-field-label">Description:</span>
                      <p className="tp-field-value">{cert.description}</p>
                    </div>
                  ) : null}
                </div>

                <div className="tp-certificate-actions">
                  {cert.hasFile && (
                    <>
                      <button
                        className="primary-button compact-button"
                        onClick={() => onViewCertificate(cert)}
                        type="button"
                      >
                        View Certificate
                      </button>
                      <button
                        className="quiet-button"
                        onClick={() => onDownloadCertificate(cert)}
                        type="button"
                      >
                        Download
                      </button>
                    </>
                  )}
                  {cert.credentialUrl && (
                    <a
                      className="text-link tp-credential-link"
                      href={cert.credentialUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Credential URL ↗
                    </a>
                  )}
                  {!cert.hasFile && !cert.credentialUrl && (
                    <span className="resume-missing">No certificate file or credential URL attached</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state certificate-empty">
            <h2>No certificates uploaded by this student yet.</h2>
            <p>Uploaded certificates will be listed here with options to view credentials and files.</p>
          </div>
        )}
      </section>
    </main>
  )
}

function EditDriveModal({ drive, onClose, onSave }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedYears, setSelectedYears] = useState(
    Array.isArray(drive.eligibleYears) && drive.eligibleYears.length
      ? drive.eligibleYears
      : ['Final Year']
  )
  const [selectedBranches, setSelectedBranches] = useState(drive.branches || [])

  async function handleSubmit(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    if (!selectedYears.length) {
      setError('Choose at least one eligible academic year.')
      return
    }
    if (!selectedBranches.length) {
      setError('Choose at least one eligible branch.')
      return
    }
    const skills = fields.get('skills').split(',').map((s) => s.trim()).filter(Boolean)
    if (!skills.length) {
      setError('Add at least one required skill.')
      return
    }

    const updatedDrive = {
      company: fields.get('company'),
      role: fields.get('role'),
      salary: Number(fields.get('salary')),
      cgpa: Number(fields.get('cgpa')),
      backlogs: Number(fields.get('backlogs')),
      status: fields.get('status'),
      deadline: fields.get('deadline'),
      description: fields.get('description'),
      branches: selectedBranches,
      eligibleYears: selectedYears,
      skills,
      preferred: fields.get('preferred').split(',').map((s) => s.trim()).filter(Boolean),
      keywords: fields.get('keywords').split(',').map((s) => s.trim()).filter(Boolean),
    }

    setSubmitting(true)
    setError('')
    try {
      await onSave(drive.id, updatedDrive)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update drive.')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-dialog edit-drive-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <p className="eyebrow-dark">DRIVE MANAGEMENT</p>
            <h2>Edit Placement Drive Eligibility &amp; Criteria</h2>
          </div>
          <button className="quiet-button" onClick={onClose} type="button">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="edit-drive-form">
          <div className="form-grid-two">
            <label>Company<input defaultValue={drive.company} name="company" required /></label>
            <label>Role title<input defaultValue={drive.role} name="role" required /></label>
            <label>CTC (LPA)<input defaultValue={drive.salary} max="200" min="0" name="salary" required step="0.1" type="number" /></label>
            <label>Status
              <select defaultValue={drive.status} name="status">
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </label>
            <label>Apply by<input defaultValue={drive.deadline} name="deadline" required type="date" /></label>
            <label>Minimum CGPA<input defaultValue={drive.cgpa} max="10" min="0" name="cgpa" required step="0.01" type="number" /></label>
            <label>Max active backlogs<input defaultValue={drive.backlogs} min="0" name="backlogs" required type="number" /></label>
          </div>

          <label>Role description
            <textarea defaultValue={drive.description} name="description" required rows="3" />
          </label>

          <fieldset className="year-picker">
            <div className="picker-header">
              <legend>Eligible academic years <span className="required-indicator">*</span></legend>
              <div className="picker-quick-actions">
                <button type="button" className="text-action-btn" onClick={() => setSelectedYears([...ACADEMIC_YEARS])}>Select all</button>
                <button type="button" className="text-action-btn" onClick={() => setSelectedYears(['Final Year'])}>Final year only</button>
                <button type="button" className="text-action-btn" onClick={() => setSelectedYears([])}>Clear</button>
              </div>
            </div>
            <div className="checkbox-grid">
              {ACADEMIC_YEARS.map((year) => (
                <label key={year} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={selectedYears.includes(year)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedYears([...selectedYears, year])
                      else setSelectedYears(selectedYears.filter((y) => y !== year))
                    }}
                  />
                  <span>{year}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="branch-picker">
            <legend>Eligible branches <span className="required-indicator">*</span></legend>
            <div className="checkbox-grid branches-grid">
              {branches.slice(1).map((b) => (
                <label key={b} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(b)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBranches([...selectedBranches, b])
                      else setSelectedBranches(selectedBranches.filter((br) => br !== b))
                    }}
                  />
                  <span>{b}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>Required skills <small>Comma separated</small>
            <input defaultValue={drive.skills?.join(', ')} name="skills" required />
          </label>
          <label>Preferred skills <small>Comma separated</small>
            <input defaultValue={drive.preferred?.join(', ')} name="preferred" />
          </label>
          <label>JD keywords <small>Comma separated</small>
            <input defaultValue={drive.keywords?.join(', ')} name="keywords" />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <button className="quiet-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button compact-button" disabled={submitting} type="submit">
              {submitting ? 'Saving changes…' : 'Save Drive Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TPCommandCenter({ driveData, studentList = [], onEditDrive }) {
  const [tab, setTab] = useState('drives')
  const [query, setQuery] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [editingDrive, setEditingDrive] = useState(null)

  const filteredDrives = driveData.filter((drive) => `${drive.company} ${drive.role}`.toLowerCase().includes(query.toLowerCase()))
  const filteredStudents = studentList.filter((student) => `${student.name} ${student.email} ${student.branch} ${student.academicYear || ''}`.toLowerCase().includes(studentQuery.toLowerCase()))
  const openDrives = driveData.filter((drive) => drive.status !== 'Closed')
  const applicationCount = driveData.reduce((sum, drive) => sum + (drive.applicantCount || 0), 0)

  return (
    <main className="workspace-content">
      <div className="workspace-heading command-heading">
        <div>
          <p className="eyebrow-dark">PLACEMENT CELL</p>
          <h1>T&amp;P Command Center</h1>
          <p>Post drives, configure multi-year eligibility, review student certificates, and evaluate talent pools.</p>
        </div>
        <a className="primary-link" href="/tp/create">＋ Create drive</a>
      </div>

      <div className="metric-grid four-metrics">
        <Metric label="Drives posted" value={driveData.length} />
        <Metric label="Open now" value={openDrives.length} />
        <Metric label="Applications" value={applicationCount} />
        <Metric label="Students registered" value={studentList.length} />
      </div>

      <div className="tab-bar" role="tablist" aria-label="T&amp;P views" style={{ marginTop: '24px' }}>
        <button
          aria-selected={tab === 'drives'}
          className={tab === 'drives' ? 'workspace-tab active' : 'workspace-tab'}
          onClick={() => setTab('drives')}
          role="tab"
          type="button"
        >
          Hiring drives ({driveData.length})
        </button>
        <button
          aria-selected={tab === 'students'}
          className={tab === 'students' ? 'workspace-tab active' : 'workspace-tab'}
          onClick={() => setTab('students')}
          role="tab"
          type="button"
        >
          Student directory ({studentList.length})
        </button>
      </div>

      {tab === 'drives' && (
        <section className="workspace-panel drive-management" style={{ marginTop: '16px' }}>
          <div className="section-heading-row">
            <div>
              <p className="eyebrow-dark">DRIVE MANAGEMENT</p>
              <h2>Hiring drives</h2>
            </div>
            <label className="compact-search">
              <span className="sr-only">Search drives</span>
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Search company or role" value={query} />
            </label>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>CTC</th>
                  <th>Eligible Years</th>
                  <th>Apply by</th>
                  <th>Status</th>
                  <th>Applicants</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrives.map((drive) => (
                  <tr key={drive.id}>
                    <td className="table-company">{drive.company}</td>
                    <td>{drive.role}</td>
                    <td>₹{drive.salary.toFixed(1)} LPA</td>
                    <td>
                      <div className="table-years-tags">
                        {(drive.eligibleYears || ['Final Year']).map((yr) => (
                          <span key={yr} className="mini-year-tag">{yr.replace(' Year', ' Yr')}</span>
                        ))}
                      </div>
                    </td>
                    <td>{formatDate(drive.deadline)}</td>
                    <td><span className={`status-pill ${drive.status.toLowerCase()}`}>{drive.status}</span></td>
                    <td>{drive.applicantCount || 0}</td>
                    <td className="drive-actions-cell">
                      <button className="quiet-button compact-button" onClick={() => setEditingDrive(drive)} type="button" title="Edit drive eligibility & criteria">
                        Edit ⚙️
                      </button>
                      <a className="text-link" href={`/tp/drives/${drive.id}`}>Review pool ↗</a>
                    </td>
                  </tr>
                ))}
                {filteredDrives.length === 0 && (
                  <tr><td colSpan="8" className="empty-table">No drives match this search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'students' && (
        <section className="workspace-panel drive-management" style={{ marginTop: '16px' }}>
          <div className="section-heading-row">
            <div>
              <p className="eyebrow-dark">TALENT POOL</p>
              <h2>Registered students</h2>
            </div>
            <label className="compact-search">
              <span className="sr-only">Search students</span>
              <input
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="Search name, branch, email or year"
                value={studentQuery}
              />
            </label>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Branch</th>
                  <th>Academic Year</th>
                  <th>CGPA</th>
                  <th>Backlogs</th>
                  <th>Certificates</th>
                  <th>Resume</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="applicant-identity">
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                    </td>
                    <td>{student.branch}</td>
                    <td>
                      {student.academicYear ? (
                        <span className="year-pill-tag">{student.academicYear}</span>
                      ) : (
                        <span className="resume-missing">Not set</span>
                      )}
                    </td>
                    <td>
                      <strong>{Number(student.cgpa).toFixed(2)}</strong>
                      {student.hasScorecard && (
                        <span className="status-pill selected" style={{ display: 'block', width: 'fit-content', fontSize: '10px', padding: '2px 6px', marginTop: '4px' }}>
                          ✓ Scorecard
                        </span>
                      )}
                    </td>
                    <td>{student.backlogs}</td>
                    <td>
                      <strong>{student.certificateCount || 0}</strong>{' '}
                      <small style={{ color: 'var(--muted)' }}>
                        certificate{student.certificateCount === 1 ? '' : 's'}
                      </small>
                    </td>
                    <td>
                      {student.hasResume ? (
                        <span className="status-pill selected" style={{ fontSize: '11px', padding: '3px 8px' }}>
                          Uploaded
                        </span>
                      ) : (
                        <span className="resume-missing">Not uploaded</span>
                      )}
                    </td>
                    <td>
                      <a className="text-link" href={`/tp/students/${student.id}`}>
                        View profile &amp; certificates ↗
                      </a>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan="8" className="empty-table">No students match this search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editingDrive && (
        <EditDriveModal
          drive={editingDrive}
          onClose={() => setEditingDrive(null)}
          onSave={async (id, payload) => {
            if (onEditDrive) await onEditDrive(id, payload)
            setEditingDrive(null)
          }}
        />
      )}

      <section className="workspace-panel command-note">
        <div>
          <p className="eyebrow-dark">VERIFIED CREDENTIALS</p>
          <h2>Holistic student evaluation</h2>
          <p>T&amp;P Officers can review verified certificates, projects, and academic scores directly from student profiles.</p>
        </div>
      </section>
    </main>
  )
}

function CreateDrivePage({ onCreateDrive }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedYears, setSelectedYears] = useState(['Final Year'])

  async function submitDrive(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    if (!selectedYears.length) {
      setError('Choose at least one eligible academic year.')
      return
    }
    const branchesSelected = fields.getAll('branches')
    const skills = fields.get('skills').split(',').map((skill) => skill.trim()).filter(Boolean)
    if (!branchesSelected.length || !skills.length) {
      setError('Choose at least one eligible branch and add one required skill.')
      return
    }

    const drive = {
      company: fields.get('company'),
      role: fields.get('role'),
      salary: Number(fields.get('salary')),
      cgpa: Number(fields.get('cgpa')),
      backlogs: Number(fields.get('backlogs')),
      branches: branchesSelected,
      eligibleYears: selectedYears,
      skills,
      preferred: fields.get('preferred').split(',').map((skill) => skill.trim()).filter(Boolean),
      keywords: fields.get('keywords').split(',').map((skill) => skill.trim()).filter(Boolean),
      deadline: fields.get('deadline'),
      description: fields.get('description'),
      status: 'Open',
    }
    setSubmitting(true)
    try {
      await onCreateDrive(drive)
    } catch (requestError) {
      setError(requestError.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="workspace-content create-drive-page">
      <a className="back-link" href="/tp">← <span>T&amp;P Center</span></a>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow-dark">NEW OPPORTUNITY</p>
          <h1>Create a placement drive</h1>
          <p>Set transparent academic years and eligibility gates before students apply.</p>
        </div>
      </div>
      <form className="workspace-panel drive-form" onSubmit={submitDrive}>
        <div className="form-section-heading"><span>01</span><div><h2>Role details</h2><p>What students need to know about the opportunity.</p></div></div>
        <div className="form-grid-two">
          <label>Company<input name="company" placeholder="Company name" required /></label>
          <label>Role title<input name="role" placeholder="Software Engineer" required /></label>
          <label>CTC (LPA)<input max="200" min="0" name="salary" required step="0.1" type="number" /></label>
          <label>Apply by<input min="2026-10-03" name="deadline" required type="date" /></label>
        </div>
        <label>Role description<textarea name="description" placeholder="Describe the work, team and interview process." required rows="4" /></label>

        <div className="form-section-heading"><span>02</span><div><h2>Eligibility</h2><p>Make the application gate clear up front.</p></div></div>
        <div className="form-grid-two">
          <label>Minimum CGPA<input max="10" min="0" name="cgpa" required step="0.01" type="number" /></label>
          <label>Maximum active backlogs<input min="0" name="backlogs" required type="number" /></label>
        </div>

        <fieldset className="year-picker">
          <div className="picker-header">
            <legend>Eligible academic years <span className="required-indicator">*</span></legend>
            <div className="picker-quick-actions">
              <button type="button" className="text-action-btn" onClick={() => setSelectedYears([...ACADEMIC_YEARS])}>Select all</button>
              <button type="button" className="text-action-btn" onClick={() => setSelectedYears(['Final Year'])}>Final year only</button>
              <button type="button" className="text-action-btn" onClick={() => setSelectedYears([])}>Clear</button>
            </div>
          </div>
          <div className="checkbox-grid">
            {ACADEMIC_YEARS.map((year) => (
              <label key={year} className="checkbox-card">
                <input
                  type="checkbox"
                  checked={selectedYears.includes(year)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedYears([...selectedYears, year])
                    else setSelectedYears(selectedYears.filter((y) => y !== year))
                  }}
                />
                <span>{year}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="branch-picker">
          <legend>Eligible branches</legend>
          <div className="checkbox-grid branches-grid">
            {branches.slice(1).map((branch) => (
              <label key={branch} className="checkbox-card">
                <input name="branches" type="checkbox" value={branch} />
                <span>{branch}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-section-heading"><span>03</span><div><h2>Scoring signals</h2><p>These are shown in each student's full match breakdown.</p></div></div>
        <label>Required skills <small>Separate items with commas</small><input name="skills" placeholder="Python, SQL, communication" required /></label>
        <label>Preferred skills <small>Separate items with commas</small><input name="preferred" placeholder="AWS, Docker" /></label>
        <label>Job-description keywords <small>Separate items with commas</small><input name="keywords" placeholder="APIs, distributed systems" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><a className="quiet-button" href="/tp">Cancel</a><button className="primary-button compact-button" disabled={submitting} type="submit">{submitting ? 'Publishing…' : 'Publish drive'}</button></div>
      </form>
    </main>
  )
}

function ApplicantReview({ drive, applicants, onUpdateStatus, onViewResume, onReloadApplicants, onEditDrive }) {
  const [query, setQuery] = useState('')
  const [recomputedApplicants, setRecomputedApplicants] = useState(null)
  const [expandedApplicantId, setExpandedApplicantId] = useState(null)
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeError, setRecomputeError] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [activeResume, setActiveResume] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const activeApplicantList = recomputedApplicants || applicants
  const visible = activeApplicantList
    .filter((applicant) => `${applicant.name} ${applicant.branch}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.score - a.score)

  useEffect(() => () => {
    if (activeResume) URL.revokeObjectURL(activeResume.url)
  }, [activeResume])

  async function openResume(applicantId) {
    try {
      const url = await onViewResume(applicantId)
      setActiveResume({ url, name: activeApplicantList.find((applicant) => applicant.id === applicantId)?.name || 'Applicant' })
    } catch (error) {
      setResumeError(error.message)
    }
  }

  async function handleRecomputeAiScores() {
    setRecomputing(true)
    setRecomputeError('')
    try {
      await apiRequest(`/tp/drives/${drive.id}/recompute-ai-scores`, { method: 'POST' })
      const res = await apiRequest(`/tp/drives/${drive.id}/applicants`)
      if (res?.applicants) {
        setRecomputedApplicants(res.applicants)
      }
      if (onReloadApplicants) {
        await onReloadApplicants()
      }
    } catch {
      setRecomputeError('AI scoring service is currently unavailable. Rule-based scores are still accurate.')
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <main className="workspace-content">
      <a className="back-link" href="/tp">← <span>T&amp;P Center</span></a>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow-dark">APPLICANT REVIEW</p>
          <h1>{drive.company} · {drive.role}</h1>
          <p>Review match signals and eligibility, then make the shortlist decision.</p>
        </div>
        <div className="workspace-heading-actions">
          <button
            type="button"
            className="quiet-button compact-button"
            onClick={() => setShowEditModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            ⚙️ Edit Drive Eligibility
          </button>
          <button
            type="button"
            className="primary-button compact-button refresh-ai-button"
            onClick={handleRecomputeAiScores}
            disabled={recomputing}
          >
            {recomputing ? (
              <>
                <span className="spinner-inline" aria-hidden="true" /> Recomputing...
              </>
            ) : (
              'Refresh AI Scores'
            )}
          </button>
        </div>
      </div>
      {recomputeError && <p className="form-error ai-recompute-error" role="alert">{recomputeError}</p>}
      <div className="metric-grid three-metrics">
        <Metric label="Applicants" value={activeApplicantList.length} />
        <Metric label="Eligible" value={activeApplicantList.filter((applicant) => applicant.cgpa >= drive.cgpa && applicant.backlogs <= drive.backlogs && drive.branches.includes(applicant.branch)).length} />
        <Metric label="Shortlisted" value={activeApplicantList.filter((applicant) => applicant.status === 'Shortlisted').length} />
      </div>
      <section className="workspace-panel">
        <div className="section-heading-row">
          <div><p className="eyebrow-dark">RANKED POOL</p><h2>Applicants</h2></div>
          <label className="compact-search"><span className="sr-only">Search applicants</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search name or branch" value={query} /></label>
        </div>
        {resumeError && <p className="form-error" role="alert">{resumeError}</p>}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Branch</th>
                <th>CGPA</th>
                <th>Match score</th>
                <th>AI Match</th>
                <th>Eligibility</th>
                <th>Resume</th>
                <th>Certificates</th>
                <th>Applied</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((applicant, index) => {
                const eligible = applicant.cgpa >= drive.cgpa && applicant.backlogs <= drive.backlogs && drive.branches.includes(applicant.branch)
                const isExpanded = expandedApplicantId === applicant.id
                const hasAiScore = applicant.aiSemanticScore !== null && applicant.aiSemanticScore !== undefined
                const aiScoreVal = hasAiScore ? Math.round(applicant.aiSemanticScore) : null
                const aiBadgeLevel = hasAiScore ? (aiScoreVal >= 70 ? 'success' : aiScoreVal >= 40 ? 'warning' : 'danger') : null

                return (
                  <Fragment key={applicant.id}>
                    <tr>
                      <td className="rank-cell">{String(index + 1).padStart(2, '0')}</td>
                      <td className="applicant-identity">
                        <a className="text-link" href={`/tp/students/${applicant.studentId}`}><strong>{applicant.name}</strong></a>
                        <small>{applicant.email}</small>
                      </td>
                      <td>{applicant.branch}</td>
                      <td>{applicant.cgpa.toFixed(1)}</td>
                      <td><strong>{applicant.score.toFixed(1)}</strong></td>
                      <td>
                        <div className="ai-score-cell">
                          {hasAiScore ? (
                            <>
                              <span className={`ai-match-badge ai-match-${aiBadgeLevel}`}>
                                {aiScoreVal}%
                              </span>
                              <button
                                type="button"
                                className="why-score-toggle-btn"
                                onClick={() => setExpandedApplicantId(isExpanded ? null : applicant.id)}
                                aria-expanded={isExpanded}
                                title={isExpanded ? 'Hide AI match breakdown' : 'Why this score?'}
                              >
                                Why this score? <span className="chevron-icon" aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
                              </button>
                            </>
                          ) : (
                            <span className="not-scored-label">Not scored</span>
                          )}
                        </div>
                      </td>
                      <td><span className={`eligibility-status ${eligible ? 'eligible' : 'ineligible'}`}>{eligible ? 'Eligible' : 'Not eligible'}</span></td>
                      <td>{applicant.hasResume ? <button className="resume-open-link" onClick={() => openResume(applicant.id)} type="button">View PDF ↗</button> : <span className="resume-missing">Not uploaded</span>}</td>
                      <td><a className="text-link" href={`/tp/students/${applicant.studentId}`}>{applicant.certificateCount || 0} cert{applicant.certificateCount === 1 ? '' : 's'} ↗</a></td>
                      <td>{formatDate(applicant.appliedAt)}</td>
                      <td>
                        <select aria-label={`Decision for ${applicant.name}`} onChange={(event) => onUpdateStatus(applicant.id, event.target.value)} value={applicant.status}>
                          <option>Under review</option>
                          <option>Shortlisted</option>
                          <option>Selected</option>
                          <option>Rejected</option>
                        </select>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="applicant-details-row">
                        <td colSpan="11">
                          <div className="ai-detail-expansion">
                            {applicant.aiExplanation && (
                              <div className="ai-explanation-callout">
                                <div className="ai-explanation-header">
                                  <span className="ai-sparkle-icon" aria-hidden="true">✨</span>
                                  <strong>AI Match Explanation</strong>
                                </div>
                                <p className="ai-explanation-text">{applicant.aiExplanation}</p>
                              </div>
                            )}

                            {applicant.aiSkillBreakdown && (
                              <div className="ai-breakdown-container">
                                <div className="ai-breakdown-group">
                                  <h4 className="ai-breakdown-title">
                                    Required Skills
                                    <span className="ai-breakdown-ratio">
                                      ({applicant.aiSkillBreakdown.required?.matched?.length || 0}/{(applicant.aiSkillBreakdown.required?.matched?.length || 0) + (applicant.aiSkillBreakdown.required?.missing?.length || 0)} matched)
                                    </span>
                                  </h4>
                                  <div className="skill-list">
                                    {applicant.aiSkillBreakdown.required?.matched?.map((skill, idx) => (
                                      <span key={`req-matched-${idx}`} className="skill-tag skill-matched" title={skill.best_match && skill.best_match !== skill.target_skill ? `Matched via "${skill.best_match}" (${Math.round((skill.similarity || 0) * 100)}% similarity)` : undefined}>
                                        ✓ {skill.target_skill}
                                        {skill.best_match && skill.best_match.toLowerCase() !== skill.target_skill.toLowerCase() && (
                                          <small className="skill-alias"> (via {skill.best_match})</small>
                                        )}
                                      </span>
                                    ))}
                                    {applicant.aiSkillBreakdown.required?.missing?.map((skill, idx) => (
                                      <span key={`req-missing-${idx}`} className="skill-tag skill-missing" title={skill.closest_candidate ? `Closest match: "${skill.closest_candidate}" (${Math.round((skill.similarity || 0) * 100)}%)` : 'Missing'}>
                                        ✕ {skill.target_skill}
                                      </span>
                                    ))}
                                    {(!applicant.aiSkillBreakdown.required?.matched?.length && !applicant.aiSkillBreakdown.required?.missing?.length) && (
                                      <span className="not-scored-label">No required skills specified</span>
                                    )}
                                  </div>
                                </div>

                                {(applicant.aiSkillBreakdown.preferred?.matched?.length > 0 || applicant.aiSkillBreakdown.preferred?.missing?.length > 0) && (
                                  <div className="ai-breakdown-group">
                                    <h4 className="ai-breakdown-title">
                                      Preferred Skills
                                      <span className="ai-breakdown-ratio">
                                        ({applicant.aiSkillBreakdown.preferred?.matched?.length || 0}/{(applicant.aiSkillBreakdown.preferred?.matched?.length || 0) + (applicant.aiSkillBreakdown.preferred?.missing?.length || 0)} matched)
                                      </span>
                                    </h4>
                                    <div className="skill-list">
                                      {applicant.aiSkillBreakdown.preferred?.matched?.map((skill, idx) => (
                                        <span key={`pref-matched-${idx}`} className="skill-tag skill-matched" title={skill.best_match && skill.best_match !== skill.target_skill ? `Matched via "${skill.best_match}"` : undefined}>
                                          ✓ {skill.target_skill}
                                          {skill.best_match && skill.best_match.toLowerCase() !== skill.target_skill.toLowerCase() && (
                                            <small className="skill-alias"> (via {skill.best_match})</small>
                                          )}
                                        </span>
                                      ))}
                                      {applicant.aiSkillBreakdown.preferred?.missing?.map((skill, idx) => (
                                        <span key={`pref-missing-${idx}`} className="skill-tag skill-missing">
                                          ✕ {skill.target_skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {applicant.aiSkillBreakdown.keywords?.matched?.length > 0 && (
                                  <div className="ai-breakdown-group">
                                    <h4 className="ai-breakdown-title">Relevant Keywords</h4>
                                    <div className="skill-list">
                                      {applicant.aiSkillBreakdown.keywords.matched.map((skill, idx) => (
                                        <span key={`kw-matched-${idx}`} className="skill-tag skill-matched">
                                          ✓ {skill.target_skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {!applicant.aiExplanation && !applicant.aiSkillBreakdown && (
                              <p className="not-scored-label">No detailed AI breakdown available for this applicant.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {visible.length === 0 && <tr><td className="empty-table" colSpan="11">No applicants match this search.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="decision-note">Shortlisting is a human decision. Match scores explain the profile; they do not make the decision.</p>
      </section>
      {activeResume && <div className="resume-viewer-backdrop" role="presentation" onClick={() => setActiveResume(null)}><section aria-label={`${activeResume.name} resume`} aria-modal="true" className="resume-viewer-dialog" onClick={(event) => event.stopPropagation()} role="dialog"><header><div><p className="eyebrow-dark">APPLICANT RESUME</p><h2>{activeResume.name}</h2></div><button aria-label="Close resume viewer" className="quiet-button" onClick={() => setActiveResume(null)} type="button">Close</button></header><iframe src={activeResume.url} title={`${activeResume.name} resume PDF`} /></section></div>}
      {showEditModal && (
        <EditDriveModal
          drive={drive}
          onClose={() => setShowEditModal(false)}
          onSave={async (id, payload) => {
            if (onEditDrive) await onEditDrive(id, payload)
            setShowEditModal(false)
          }}
        />
      )}
    </main>
  )
}

function AlumniHub({
  driveData,
  user,
  mentors,
  mentorshipRequests,
  _interviewSlots,
  referrals,
  forumPosts,
  _onRequestMentorship,
  onUpdateMentorshipRequest,
  _onBookInterview,
  _onCreateInterviewSlot,
  onRequestReferral,
  onCreateForumPost,
  onFetchPostReplies,
  connectionRequests = [],
  conversations = [],
  activeChatConversationId = null,
  setActiveChatConversationId,
  onSendConnectionRequest,
  onUpdateConnectionRequestStatus,
  onRefreshConversations,
  _onRefreshConnectionRequests,
  onUpdateAlumniProfile,
  activeAlumniTab,
  onSelectAlumniTab,
}) {
  const isAlumni = user.role === 'Alumni'
  const [internalTab, setInternalTab] = useState(() => (
    typeof window !== 'undefined' && window.location.search.includes('tab=profile')
      ? 'Profile'
      : isAlumni
        ? 'Connection Requests'
        : 'Mentorship'
  ))
  const tab = activeAlumniTab || internalTab
  const [connectModalAlumni, setConnectModalAlumni] = useState(null)
  const [profileTabMode, setProfileTabMode] = useState(() => (
    typeof window !== 'undefined' && (window.location.search.includes('edit=true') || window.location.search.includes('tab=edit-profile'))
      ? 'edit'
      : 'view'
  ))
  const [actionError, setActionError] = useState('')
  const incomingRequests = mentorshipRequests.filter((request) => request.alumni_id === user.id)

  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
  const pendingRequestsCount = connectionRequests.filter((r) => r.status === 'Pending').length

  function handleTabChange(nextTab) {
    setInternalTab(nextTab)
    if (onSelectAlumniTab) {
      onSelectAlumniTab(nextTab)
    }
    if (nextTab === 'Profile' || nextTab === 'My Profile') {
      window.history.replaceState(null, '', '/alumni?tab=profile')
    } else if (window.location.search.includes('tab=profile')) {
      window.history.replaceState(null, '', '/alumni')
    }
  }

  function handleOpenEditProfile() {
    handleTabChange('Profile')
    setProfileTabMode('edit')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const tabs = isAlumni
    ? [
        pendingRequestsCount > 0 ? `Connection Requests (${pendingRequestsCount})` : 'Connection Requests',
        unreadTotal > 0 ? `Messages (${unreadTotal})` : 'Messages',
        'Mentorship',
        'Referral desk',
        'Forum',
        'Profile',
      ]
    : [
        'Mentorship',
        'My Connections',
        unreadTotal > 0 ? `Messages (${unreadTotal})` : 'Messages',
        'Referral desk',
        'Forum',
      ]

  function openChatWithConversation(convId) {
    let targetId = convId
    if (!targetId && conversations.length > 0) {
      targetId = conversations[0].id
    }
    if (setActiveChatConversationId && targetId) {
      setActiveChatConversationId(targetId)
    }
    handleTabChange(unreadTotal > 0 ? `Messages (${unreadTotal})` : 'Messages')
  }


  return (
    <main className="workspace-content alumni-workspace">
      <section className="alumni-hero">
        <div><p className="eyebrow">ALUMNI CONNECT HUB</p><h1>Welcome back to campus</h1><p>Share what you’ve learned. Help the next class take its next step.</p></div>
        <a className="hero-action" href="/">Browse open drives ↗</a>
      </section>

      <div className="alumni-stats"><span><strong>{mentors.length}</strong> alumni profiles</span><span><strong>{connectionRequests.filter((r) => r.status === 'Accepted').length}</strong> connections</span><span><strong>{referrals.length}</strong> referral threads</span><span><strong>{driveData.length}</strong> open drives</span></div>
      <div className="tab-bar" role="tablist" aria-label="Alumni tools">
        {tabs.map((item) => (
          <button
            aria-selected={tab === item || (item.startsWith('Messages') && tab.startsWith('Messages')) || (item.startsWith('Connection Requests') && tab.startsWith('Connection Requests'))}
            className={(tab === item || (item.startsWith('Messages') && tab.startsWith('Messages')) || (item.startsWith('Connection Requests') && tab.startsWith('Connection Requests'))) ? 'workspace-tab active' : 'workspace-tab'}
            key={item}
            onClick={() => handleTabChange(item)}
            role="tab"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      <div className={`alumni-hub-grid-layout${(!isAlumni || tab.startsWith('Messages') || tab === 'Profile') ? ' full-width' : ''}`}>
        <div className="alumni-hub-main-column">
          {(tab.startsWith('Connection Requests') || tab === 'My Connections') && (
            <ConnectionRequestsView
              connectionRequests={connectionRequests}
              onOpenChat={openChatWithConversation}
              onUpdateRequestStatus={onUpdateConnectionRequestStatus}
              user={user}
            />
          )}

          {tab.startsWith('Messages') && (
            <PrivateChatView
              activeConversationId={activeChatConversationId}
              conversations={conversations}
              onRefreshConversations={onRefreshConversations}
              onSelectConversation={setActiveChatConversationId}
              user={user}
            />
          )}

          {tab === 'Mentorship' && (
            <section className="alumni-content">
              <div className="section-heading-row">
                <div><p className="eyebrow-dark">PEER NETWORK</p><h2>{isAlumni ? 'Mentorship requests' : 'Find alumni & mentors'}</h2></div>
                <span className="muted-count">{isAlumni ? `${incomingRequests.length} requests received` : `${mentors.length} alumni available`}</span>
              </div>
              {isAlumni ? (
                <div className="slot-list">
                  {incomingRequests.map((request) => (
                    <article className="slot-row" key={request.id}>
                      <div><p className="eyebrow-dark">{request.status}</p><h3>{request.student_name}</h3><p>{request.message || 'Requested a mentorship connection.'}</p></div>
                      <div className="action-pair">
                        <button className="quiet-button" disabled={request.status !== 'Pending'} onClick={async () => { try { await onUpdateMentorshipRequest(request.id, 'Accepted') } catch (error) { setActionError(error.message) } }} type="button">Accept</button>
                        <button className="quiet-button" disabled={request.status !== 'Pending'} onClick={async () => { try { await onUpdateMentorshipRequest(request.id, 'Declined') } catch (error) { setActionError(error.message) } }} type="button">Decline</button>
                      </div>
                    </article>
                  ))}
                  {incomingRequests.length === 0 && <div className="empty-state"><h2>No mentorship requests yet</h2><p>Student requests will appear here.</p></div>}
                </div>
              ) : (
                <div className="mentor-grid">
                  {mentors.filter((mentor) => mentor.id !== user.id).map((mentor) => {
                    const connection = connectionRequests.find((cr) => cr.alumniId === mentor.id || cr.alumni_id === mentor.id)
                    const conv = conversations.find((c) => c.partner?.id === mentor.id || c.alumniId === mentor.id || c.id === connection?.conversationId)
                    return (
                      <article className="mentor-card" key={mentor.id}>
                        <div className="mentor-avatar">{mentor.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
                        <p className="eyebrow-dark">{mentor.company || 'Alumni'}</p>
                        <h3>{mentor.name}</h3>
                        <p className="mentor-role">{mentor.job_title || 'Alumni mentor'}</p>
                        {mentor.experience ? <span className="mentor-exp-tag">💼 {mentor.experience}</span> : null}
                        {mentor.bio ? <p className="mentor-card-bio">{mentor.bio}</p> : null}
                        {Array.isArray(mentor.skills) && mentor.skills.length > 0 ? (
                          <div className="skill-list compact-skills">
                            {mentor.skills.slice(0, 3).map((s) => <span className="skill-tag" key={s}>{s}</span>)}
                          </div>
                        ) : null}
                        <div className="mentor-card-actions">
                          {connection?.status === 'Accepted' ? (
                            <button
                              className="message-action-btn"
                              onClick={() => openChatWithConversation(conv?.id || connection?.conversationId)}
                              type="button"
                            >
                              💬 Message
                            </button>
                          ) : connection?.status === 'Pending' ? (
                            <button className="quiet-button connection-pending-btn" disabled type="button">
                              ⏳ Request Pending
                            </button>
                          ) : connection?.status === 'Rejected' ? (
                            <button
                              className="primary-button compact-button"
                              onClick={() => setConnectModalAlumni(mentor)}
                              type="button"
                            >
                              Re-connect
                            </button>
                          ) : (
                            <button
                              className="primary-button compact-button"
                              onClick={() => setConnectModalAlumni(mentor)}
                              type="button"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                  {mentors.length <= 1 && <div className="empty-state"><h2>No alumni profiles yet</h2><p>Alumni who create an account will be available to connect here.</p></div>}
                </div>
              )}
              {actionError && <p className="form-error" role="alert">{actionError}</p>}
            </section>
          )}

          {tab === 'Referral desk' && <ReferralDesk driveData={driveData} isAlumni={isAlumni} onRequestReferral={onRequestReferral} referrals={referrals} />}

          {tab === 'Forum' && (
            <ForumSection
              user={user}
              forumPosts={forumPosts}
              onCreateForumPost={onCreateForumPost}
              onFetchPostReplies={onFetchPostReplies}
            />
          )}

          {tab === 'Profile' && (
            <section className="alumni-content alumni-profile-section-tab">
              <div className="section-heading-row alumni-profile-heading-row">
                <div>
                  <p className="eyebrow-dark">YOUR PROFESSIONAL PROFILE</p>
                  <h2>Alumni Profile &amp; Mentorship Settings</h2>
                </div>
                <div className="alumni-profile-mode-toggle" role="group" aria-label="Profile View Mode">
                  <button
                    className={profileTabMode === 'view' ? 'mode-pill-btn active' : 'mode-pill-btn'}
                    onClick={() => setProfileTabMode('view')}
                    type="button"
                  >
                    👁️ View Profile
                  </button>
                  <button
                    className={profileTabMode === 'edit' ? 'mode-pill-btn active' : 'mode-pill-btn'}
                    onClick={() => setProfileTabMode('edit')}
                    type="button"
                  >
                    ✏️ Edit Profile
                  </button>
                </div>
              </div>

              {profileTabMode === 'edit' ? (
                <AlumniEditProfileTabPanel
                  key={user?.id || 'profile'}
                  onCancel={() => setProfileTabMode('view')}
                  onSave={async (updatedData) => {
                    await onUpdateAlumniProfile(updatedData)
                    setProfileTabMode('view')
                  }}
                  user={user}
                />
              ) : (
                <AlumniProfileTopCard
                  onOpenEdit={() => setProfileTabMode('edit')}
                  user={user}
                />
              )}
            </section>
          )}
        </div>

        {isAlumni && !tab.startsWith('Messages') && tab !== 'Profile' && (
          <aside className="alumni-hub-right-sidebar" aria-label="Alumni Profile">
            <div className="sidebar-sticky-wrap">
              <div className="sidebar-header-label">
                <span className="eyebrow-dark">ALUMNI PROFILE</span>
              </div>
              <AlumniProfileTopCard
                isSidebar
                onOpenEdit={handleOpenEditProfile}
                user={user}
              />
            </div>
          </aside>
        )}
      </div>

      {connectModalAlumni && (
        <ConnectModal
          alumni={connectModalAlumni}
          onClose={() => setConnectModalAlumni(null)}
          onSuccess={(newReq) => {
            if (onSendConnectionRequest) onSendConnectionRequest(newReq)
          }}
        />
      )}
    </main>
  )
}

function ReferralDesk({ driveData, referrals, isAlumni, onRequestReferral }) {
  return (
    <section className="alumni-content"><div className="section-heading-row"><div><p className="eyebrow-dark">OPEN OPPORTUNITIES</p><h2>Referral desk</h2></div><span className="muted-count">{referrals.length} requests started</span></div>{driveData.length ? <div className="referral-list">{driveData.map((drive) => { const referral = referrals.find((item) => item.drive_id === drive.id); return <article className="referral-row" key={drive.id}><div><p className="company-name">{drive.company}</p><h3>{drive.role}</h3><p>₹{drive.salary.toFixed(1)} LPA <span>·</span> Apply by {formatDate(drive.deadline)}{referral ? ` · ${referral.status}` : ''}</p></div>{isAlumni ? <button className="quiet-button" disabled={Boolean(referral)} onClick={() => onRequestReferral(drive.id)} type="button">{referral ? 'Request started' : 'Start referral request'}</button> : <a className="text-link" href={`/drives/${drive.id}`}>View drive ↗</a>}</article> })}</div> : <div className="empty-state"><h2>No open drives</h2><p>Referral opportunities will appear when T&amp;P officers publish drives.</p></div>}</section>
  )
}

function timeAgo(date) {
  if (!date) return ''
  const value = String(date)
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : `${value.replace(' ', 'T')}${value.endsWith('Z') ? '' : 'Z'}`
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return value
  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 0) return 'Just now'
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 45) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function getInitials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name = '') {
  const colors = [
    '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626',
    '#0891b2', '#4f46e5', '#db2777', '#0284c7', '#0d9488'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function ForumPostCard({ post, user, onCreateForumPost, onFetchPostReplies }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingReplies, setIsLoadingReplies] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(() => Math.floor((post.id.charCodeAt(0) % 7) + 1))
  const [replyLikes, setReplyLikes] = useState({})

  const replies = post.repliesList || []
  const replyCount = Math.max(post.replies || 0, replies.length)

  async function handleToggleReplies() {
    const nextExpanded = !isExpanded
    setIsExpanded(nextExpanded)
    if (nextExpanded && (!post.repliesList || post.repliesList.length === 0) && replyCount > 0 && onFetchPostReplies) {
      setIsLoadingReplies(true)
      try {
        await onFetchPostReplies(post.id)
      } finally {
        setIsLoadingReplies(false)
      }
    }
  }

  function handleStartReply(mentionAuthor = null) {
    setIsReplying(true)
    if (mentionAuthor && mentionAuthor !== user?.name) {
      setReplyText((prev) => (prev.startsWith(`@${mentionAuthor} `) ? prev : `@${mentionAuthor} ${prev}`))
    }
  }

  async function handleSubmitReply(e) {
    if (e) e.preventDefault()
    const content = replyText.trim()
    if (!content || isSubmitting) return

    setIsSubmitting(true)
    setReplyError('')
    try {
      await onCreateForumPost(content, post.id)
      setReplyText('')
      setIsReplying(false)
      setIsExpanded(true)
    } catch (err) {
      setReplyError(err.message || 'Failed to post reply')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleToggleLike() {
    setLiked((prev) => {
      setLikesCount((count) => (prev ? count - 1 : count + 1))
      return !prev
    })
  }

  function handleToggleReplyLike(replyId) {
    setReplyLikes((prev) => {
      const isCurLiked = prev[replyId]
      return { ...prev, [replyId]: !isCurLiked }
    })
  }

  function renderFormattedContent(text) {
    if (!text) return null
    const parts = text.split(/(@[a-zA-Z0-9_\s]{2,25}(?=\s|$|[.,!?]))/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return <span key={index} className="yt-mention-tag">{part}</span>
      }
      return part
    })
  }

  return (
    <article className="yt-forum-card">
      <div className="yt-post-main">
        {/* Avatar */}
        <div
          className="yt-avatar yt-avatar-md"
          style={{ background: getAvatarColor(post.author) }}
          aria-hidden="true"
        >
          {getInitials(post.author)}
        </div>

        {/* Content wrap */}
        <div className="yt-post-content-wrap">
          <header className="yt-post-header">
            <span className="yt-author-name">{post.author}</span>
            {post.authorRole && (
              <span className={`yt-role-badge ${post.authorRole.toLowerCase().replace(/[^a-z]/g, '')}`}>
                {post.authorRole === 'Alumni' && post.authorCompany
                  ? `Alumni · ${post.authorCompany}`
                  : post.authorRole === 'Student' && post.authorBranch
                  ? `Student · ${post.authorBranch}`
                  : post.authorRole}
              </span>
            )}
            <span className="yt-dot-sep">•</span>
            <span className="yt-post-time" title={post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}>
              {timeAgo(post.createdAt)}
            </span>
          </header>

          <div className="yt-post-body">
            <p>{post.content}</p>
          </div>

          {/* Action Row */}
          <div className="yt-actions-row">
            <button
              type="button"
              className={`yt-action-btn ${liked ? 'active-liked' : ''}`}
              onClick={handleToggleLike}
              title="Like this discussion"
              aria-label="Like"
            >
              <svg viewBox="0 0 24 24" className="yt-icon" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span>{likesCount > 0 ? likesCount : ''}</span>
            </button>

            <button
              type="button"
              className="yt-action-btn"
              onClick={() => handleStartReply()}
              aria-label="Reply to discussion"
            >
              <svg viewBox="0 0 24 24" className="yt-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 17 4 12 9 7" />
                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
              </svg>
              <span>Reply</span>
            </button>
          </div>

          {/* YouTube-style Replies Toggle Button */}
          {replyCount > 0 && (
            <button
              type="button"
              className={`yt-replies-toggle-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={handleToggleReplies}
              aria-expanded={isExpanded}
            >
              <svg viewBox="0 0 24 24" className="yt-toggle-chevron" fill="currentColor">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
              <span className="yt-toggle-label">
                {isExpanded
                  ? `Hide ${replyCount === 1 ? 'reply' : `${replyCount} replies`}`
                  : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
              </span>
            </button>
          )}

          {/* Inline Reply Composer */}
          {isReplying && (
            <form className="yt-inline-reply-composer" onSubmit={handleSubmitReply}>
              <div
                className="yt-avatar yt-avatar-sm"
                style={{ background: getAvatarColor(user?.name || 'You') }}
                aria-hidden="true"
              >
                {getInitials(user?.name || 'You')}
              </div>
              <div className="yt-composer-inner">
                <textarea
                  className="yt-composer-textarea"
                  rows={2}
                  placeholder="Add a reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      handleSubmitReply(e)
                    }
                  }}
                  autoFocus
                />
                {replyError && <p className="form-error" role="alert">{replyError}</p>}
                <div className="yt-composer-footer">
                  <span className="yt-composer-hint">Ctrl + Enter to reply</span>
                  <div className="yt-composer-buttons">
                    <button
                      type="button"
                      className="yt-cancel-btn"
                      onClick={() => { setIsReplying(false); setReplyText(''); setReplyError('') }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-button compact-button yt-reply-submit"
                      disabled={!replyText.trim() || isSubmitting}
                    >
                      {isSubmitting ? 'Replying…' : 'Reply'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Expanded Replies Thread */}
          {isExpanded && (
            <div className="yt-replies-thread" role="region" aria-label={`Replies to ${post.author}'s post`}>
              {isLoadingReplies && (
                <div className="yt-replies-loading">
                  <div className="yt-mini-spinner" />
                  <span>Loading replies…</span>
                </div>
              )}

              {replies.map((reply) => {
                const replyLiked = Boolean(replyLikes[reply.id])
                return (
                  <div className="yt-reply-item" key={reply.id}>
                    <div
                      className="yt-avatar yt-avatar-sm"
                      style={{ background: getAvatarColor(reply.author) }}
                      aria-hidden="true"
                    >
                      {getInitials(reply.author)}
                    </div>
                    <div className="yt-reply-content-wrap">
                      <header className="yt-reply-header">
                        <strong className="yt-reply-author">{reply.author}</strong>
                        {reply.authorRole && (
                          <span className={`yt-role-badge sm ${reply.authorRole.toLowerCase().replace(/[^a-z]/g, '')}`}>
                            {reply.authorRole === 'Alumni' && reply.authorCompany
                              ? `Alumni · ${reply.authorCompany}`
                              : reply.authorRole}
                          </span>
                        )}
                        <span className="yt-dot-sep">•</span>
                        <span className="yt-post-time" title={reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}>
                          {timeAgo(reply.createdAt)}
                        </span>
                      </header>

                      <div className="yt-reply-body">
                        <p>{renderFormattedContent(reply.content)}</p>
                      </div>

                      <div className="yt-reply-actions">
                        <button
                          type="button"
                          className={`yt-action-btn yt-action-btn-sm ${replyLiked ? 'active-liked' : ''}`}
                          onClick={() => handleToggleReplyLike(reply.id)}
                          aria-label="Like reply"
                        >
                          <svg viewBox="0 0 24 24" className="yt-icon-sm" fill={replyLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                          </svg>
                          <span>{replyLiked ? '1' : ''}</span>
                        </button>

                        <button
                          type="button"
                          className="yt-action-btn yt-action-btn-sm"
                          onClick={() => handleStartReply(reply.author)}
                          aria-label={`Reply to ${reply.author}`}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {replies.length === 0 && !isLoadingReplies && (
                <div className="yt-no-replies">
                  <span>No replies yet. Be the first to join the conversation!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function ForumSection({ user, forumPosts = [], onCreateForumPost, onFetchPostReplies }) {
  const [newDiscussionText, setNewDiscussionText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [isComposing, setIsComposing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [postError, setPostError] = useState('')

  async function handleCreateDiscussion(e) {
    if (e) e.preventDefault()
    const content = newDiscussionText.trim()
    if (!content || isSubmitting) return

    setIsSubmitting(true)
    setPostError('')
    try {
      await onCreateForumPost(content, null)
      setNewDiscussionText('')
      setIsComposing(false)
    } catch (err) {
      setPostError(err.message || 'Failed to post discussion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredPosts = forumPosts.filter((post) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchAuthor = post.author?.toLowerCase().includes(q)
      const matchContent = post.content?.toLowerCase().includes(q)
      if (!matchAuthor && !matchContent) return false
    }
    return true
  })

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === 'active') {
      const aReplies = (a.repliesList?.length || 0) || (a.replies || 0)
      const bReplies = (b.repliesList?.length || 0) || (b.replies || 0)
      if (bReplies !== aReplies) return bReplies - aReplies
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <section className="alumni-content yt-forum-container">
      {/* Header */}
      <div className="yt-forum-header">
        <div>
          <p className="eyebrow-dark">COMMUNITY DISCUSSIONS</p>
          <h2>Alumni &amp; Campus Forum</h2>
          <p className="yt-forum-subtitle">
            Exchange advice, share interview preparation journeys, and connect openly across classes.
          </p>
        </div>
        <div className="yt-forum-meta-badge">
          <strong>{forumPosts.length}</strong>
          <span>{forumPosts.length === 1 ? 'Discussion' : 'Discussions'}</span>
        </div>
      </div>

      {/* Main Composer Card */}
      <div className={`yt-main-composer-card ${isComposing ? 'focused' : ''}`}>
        <div className="yt-composer-row">
          <div
            className="yt-avatar yt-avatar-md"
            style={{ background: getAvatarColor(user?.name || 'You') }}
            aria-hidden="true"
          >
            {getInitials(user?.name || 'You')}
          </div>
          <div className="yt-composer-field">
            <textarea
              className="yt-composer-input"
              rows={isComposing ? 3 : 1}
              placeholder="Start a campus discussion or ask alumni for guidance…"
              value={newDiscussionText}
              onChange={(e) => setNewDiscussionText(e.target.value)}
              onFocus={() => setIsComposing(true)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  handleCreateDiscussion(e)
                }
              }}
            />
          </div>
        </div>

        {postError && <p className="form-error yt-post-error" role="alert">{postError}</p>}

        {isComposing && (
          <div className="yt-composer-actions-bar">
            <span className="yt-composer-shortcut-hint">Press Ctrl + Enter to publish</span>
            <div className="yt-composer-btns">
              <button
                type="button"
                className="yt-cancel-btn"
                onClick={() => {
                  setIsComposing(false)
                  setNewDiscussionText('')
                  setPostError('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button compact-button"
                disabled={!newDiscussionText.trim() || isSubmitting}
                onClick={handleCreateDiscussion}
              >
                {isSubmitting ? 'Posting…' : 'Post Discussion'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="yt-forum-toolbar">
        <div className="yt-search-wrap">
          <svg viewBox="0 0 24 24" className="yt-search-icon" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="yt-search-input"
            placeholder="Search discussions or questions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="yt-sort-group">
          <label htmlFor="forum-sort-select" className="yt-sort-label">Sort by:</label>
          <select
            id="forum-sort-select"
            className="yt-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="latest">Latest First</option>
            <option value="active">Most Replies</option>
          </select>
        </div>
      </div>

      {/* Discussion List */}
      <div className="yt-forum-list">
        {sortedPosts.map((post) => (
          <ForumPostCard
            key={post.id}
            post={post}
            user={user}
            onCreateForumPost={onCreateForumPost}
            onFetchPostReplies={onFetchPostReplies}
          />
        ))}

        {sortedPosts.length === 0 && (
          <div className="empty-state yt-empty-discussions">
            <h2>{searchQuery ? 'No matching discussions' : 'Start the first discussion'}</h2>
            <p>
              {searchQuery
                ? `No discussions found matching "${searchQuery}". Try a different keyword.`
                : 'Questions, interview insights, and advice posted by your campus community will appear here.'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function AuthPage({ mode, onAuthenticate, theme, onToggleTheme }) {
  const isRegister = mode === 'register'
  const [role, setRole] = useState('Student')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitForm(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError('')
    setSubmitting(true)
    const payload = { email: formData.get('email'), password: formData.get('password') }
    let endpoint = '/auth/login'
    if (isRegister) {
      endpoint = '/auth/register'
      payload.name = formData.get('name')
      payload.role = role
      if (role === 'Student') {
        payload.branch = formData.get('branch')
        payload.academicYear = formData.get('academicYear') || 'Final Year'
        payload.cgpa = Number(formData.get('cgpa'))
        payload.backlogs = Number(formData.get('backlogs'))
        payload.certifications = Number(formData.get('certifications'))
        payload.skills = String(formData.get('skills') || '').split(',').map((skill) => skill.trim()).filter(Boolean)
      }
      if (role === 'Alumni') {
        payload.company = formData.get('company')
        payload.jobTitle = formData.get('jobTitle')
      }
    }
    try {
      const session = await apiRequest(endpoint, { method: 'POST', body: payload })
      onAuthenticate(session)
      setMessage(isRegister ? 'Account created. Opening your workspace…' : 'Signed in. Opening your workspace…')
      window.location.href = roleRoutes[session.user.role]
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-top-bar">
        <a className="brand auth-brand" href="/">
          <BrandMark />
          <span>CareerBridge <b>AI</b></span>
        </a>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <section className="auth-panel">
        <h1>{isRegister ? 'Create your account' : 'Sign in'}</h1>
        <p className="auth-intro">{isRegister ? 'Create an account for your campus role.' : 'Sign in to your CareerBridge account.'}</p>
        {isRegister && (
          <div className="role-options" role="group" aria-label="Choose account role">
            {['Student', 'Alumni', 'T&P Officer'].map((item) => (
              <button className={role === item ? 'role-option selected' : 'role-option'} key={item} onClick={() => setRole(item)} type="button">{item}</button>
            ))}
          </div>
        )}
        <form className="auth-form" onSubmit={submitForm}>
          {isRegister && <label>Full name<input autoComplete="name" name="name" placeholder="Priya Sharma" required /></label>}
          {isRegister && role === 'Student' && <>
            <div className="form-grid-two">
              <label>Branch<select defaultValue="CSE" name="branch">{branches.slice(1).map((branch) => <option key={branch}>{branch}</option>)}</select></label>
              <label>Academic Year
                <select defaultValue="Final Year" name="academicYear" required>
                  {ACADEMIC_YEARS.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </label>
              <label>CGPA<input max="10" min="0" name="cgpa" required step="0.01" type="number" /></label>
              <label>Active backlogs<input defaultValue="0" min="0" name="backlogs" required type="number" /></label>
              <label>Certifications<input defaultValue="0" min="0" name="certifications" required type="number" /></label>
            </div>
            <label>Skills <small>Separate items with commas</small><input name="skills" placeholder="Python, SQL, React" /></label>
          </>}
          {isRegister && role === 'Alumni' && <div className="form-grid-two"><label>Company<input autoComplete="organization" name="company" placeholder="Company" /></label><label>Current role<input name="jobTitle" placeholder="Job title" /></label></div>}
          <label>Email<input autoComplete="email" name="email" placeholder="you@campus.edu" type="email" required /></label>
          <label>Password<input autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="8" name="password" placeholder="At least 8 characters" type="password" required /></label>
          <button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-message" role="status">{message}</p>}
        </form>
        <p className="auth-switch">{isRegister ? 'Already registered?' : 'New here?'} <a href={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</a></p>
      </section>
    </main>
  )
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cb-theme')
      if (saved) return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('cb-theme', theme)
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0A1420' : '#F7F9FB')
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const [user, setUser] = useState(() => getSession().user)
  const [profile, setProfile] = useState(null)
  const [resume, setResume] = useState(null)
  const [scorecard, setScorecard] = useState(null)
  const [certificates, setCertificates] = useState([])
  const [applications, setApplications] = useState([])
  const [driveData, setDriveData] = useState([])
  const [activeDrive, setActiveDrive] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [studentList, setStudentList] = useState([])
  const [activeStudent, setActiveStudent] = useState(null)
  const [activeResume, setActiveResume] = useState(null)
  const [activeCertificateModal, setActiveCertificateModal] = useState(null)
  const [mentors, setMentors] = useState([])
  const [mentorshipRequests, setMentorshipRequests] = useState([])
  const [connectionRequests, setConnectionRequests] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeChatConversationId, setActiveChatConversationId] = useState(null)
  const [interviewSlots, setInterviewSlots] = useState([])
  const [referrals, setReferrals] = useState([])
  const [forumPosts, setForumPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [alumniTab, setAlumniTab] = useState(() => (typeof window !== 'undefined' && window.location.search.includes('tab=profile') ? 'Profile' : null))
  const path = window.location.pathname
  const detailId = path.startsWith('/drives/') ? path.split('/')[2] : null
  const isAuth = path === '/login' || path === '/register'
  const expectedRole = path.startsWith('/student') ? 'Student' : path.startsWith('/tp') ? 'T&P Officer' : path === '/alumni' ? null : null

  useEffect(() => {
    let cancelled = false
    async function loadRoute() {
      if (isAuth) {
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError('')
      let activeUser = null
      if (getSession().token) {
        try {
          const session = await apiRequest('/auth/me')
          activeUser = session.user
          setUser(activeUser)
        } catch {
          clearSession()
          setUser(null)
        }
      } else {
        setUser(null)
      }
      if (cancelled) return
      if ((expectedRole && activeUser?.role !== expectedRole)
        || (path === '/alumni' && !['Student', 'Alumni'].includes(activeUser?.role))) {
        window.location.replace('/login')
        return
      }

      try {
        if (activeUser?.role === 'Student') {
          const [profileResponse, resumeResponse, scorecardResponse, certificateResponse, applicationResponse] = await Promise.all([
            apiRequest('/student/profile'),
            apiRequest('/student/resume'),
            apiRequest('/student/scorecard'),
            apiRequest('/student/certificates'),
            apiRequest('/student/applications'),
          ])
          if (cancelled) return
          setProfile(profileResponse.profile)
          setResume(resumeResponse.resume)
          setScorecard(scorecardResponse.scorecard)
          setCertificates(certificateResponse.certificates)
          setApplications(applicationResponse.applications)
        }

        if (path.startsWith('/tp')) {
          if (path.startsWith('/tp/drives/')) {
            const id = path.split('/')[3]
            const [driveResponse, applicantResponse] = await Promise.all([
              apiRequest('/tp/drives'),
              apiRequest(`/tp/drives/${id}/applicants`),
            ])
            if (cancelled) return
            setDriveData(driveResponse.drives)
            setActiveDrive(driveResponse.drives.find((drive) => drive.id === id) || null)
            setApplicants(applicantResponse.applicants)
          } else if (path.startsWith('/tp/students/')) {
            const studentId = path.split('/')[3]
            const studentResponse = await apiRequest(`/tp/students/${studentId}`)
            if (cancelled) return
            setActiveStudent(studentResponse.student)
          } else if (path === '/tp') {
            const [driveResponse, studentResponse] = await Promise.all([
              apiRequest('/tp/drives'),
              apiRequest('/tp/students'),
            ])
            if (cancelled) return
            setDriveData(driveResponse.drives)
            setStudentList(studentResponse.students)
          }
        } else {
          const response = detailId
            ? await apiRequest(`/drives/${detailId}`)
            : await apiRequest('/drives')
          if (cancelled) return
          if (detailId) setActiveDrive(response.drive)
          else setDriveData(response.drives)
        }

        if (path === '/alumni') {
          const [mentorResponse, requestResponse, slotResponse, referralResponse, forumResponse, connResponse, convResponse] = await Promise.all([
            apiRequest('/alumni/mentors'),
            apiRequest('/alumni/mentorship-requests'),
            apiRequest('/alumni/interview-slots'),
            apiRequest('/alumni/referrals'),
            apiRequest('/alumni/forum'),
            apiRequest('/connections/requests').catch(() => ({ requests: [] })),
            apiRequest('/chat/conversations').catch(() => ({ conversations: [] })),
          ])
          if (cancelled) return
          setMentors(mentorResponse.mentors)
          setMentorshipRequests(requestResponse.requests)
          setInterviewSlots(slotResponse.slots)
          setReferrals(referralResponse.referrals)
          setForumPosts(forumResponse.posts)
          setConnectionRequests(connResponse.requests || [])
          setConversations(convResponse.conversations || [])
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadRoute()
    return () => { cancelled = true }
  }, [detailId, expectedRole, isAuth, path])

  useEffect(() => () => {
    if (activeResume?.url) URL.revokeObjectURL(activeResume.url)
    if (activeCertificateModal?.url) URL.revokeObjectURL(activeCertificateModal.url)
  }, [activeResume, activeCertificateModal])

  function authenticate(session) {
    saveSession(session)
    setUser(session.user)
  }

  function signOut() {
    clearSession()
    window.location.href = '/'
  }

  if (isAuth) return <AuthPage mode={path.slice(1)} onAuthenticate={authenticate} theme={theme} onToggleTheme={toggleTheme} />
  if (loading) return <main className="route-loading">Loading CareerBridge…</main>
  if (loadError) return <main className="route-loading" role="alert"><div><p>{loadError}</p><button className="quiet-button" onClick={() => window.location.reload()} type="button">Try again</button></div></main>

  async function saveProfile(nextProfile) {
    const response = await apiRequest('/student/profile', { method: 'PUT', body: nextProfile })
    setProfile(response.profile)
  }

  async function saveResume(file) {
    const formData = new FormData()
    formData.append('resume', file)
    const response = await apiRequest('/student/resume', { method: 'POST', body: formData })
    setResume(response.resume)
  }

  async function saveScorecard(file) {
    const formData = new FormData()
    formData.append('scorecard', file)
    const response = await apiRequest('/student/scorecard', { method: 'POST', body: formData })
    setScorecard(response.scorecard)
  }

  async function viewStudentScorecard() {
    const url = await protectedFileUrl('/student/scorecard/file')
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function updateSemGpa(semGpa) {
    const response = await apiRequest('/student/sem-gpa', { method: 'PUT', body: { semGpa } })
    setProfile(response.profile)
  }

  async function viewTPStudentScorecard(studentId) {
    try {
      const url = await protectedFileUrl(`/tp/students/${studentId}/scorecard`)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      alert(err.message || 'Unable to open scorecard PDF.')
    }
  }

  async function downloadTPStudentScorecard(studentId, name) {
    try {
      await downloadProtectedFile(`/tp/students/${studentId}/scorecard`, `${name}-Scorecard.pdf`)
    } catch (err) {
      alert(err.message || 'Unable to download scorecard PDF.')
    }
  }

  async function createCertificate(formData) {
    const response = await apiRequest('/student/certificates', { method: 'POST', body: formData })
    setCertificates((items) => [response.certificate, ...items])
  }

  async function updateCertificate(id, formData) {
    const response = await apiRequest(`/student/certificates/${id}`, { method: 'PUT', body: formData })
    setCertificates((items) => items.map((item) => item.id === id ? response.certificate : item))
  }

  async function deleteCertificate(id) {
    await apiRequest(`/student/certificates/${id}`, { method: 'DELETE' })
    setCertificates((items) => items.filter((item) => item.id !== id))
  }

  async function viewCertificate(id) {
    const url = await protectedFileUrl(`/student/certificates/${id}/file`)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function viewStudentResume() {
    const url = await protectedFileUrl('/student/resume/file')
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function viewTPCertificate(cert) {
    try {
      const url = await protectedFileUrl(`/tp/certificates/${cert.id}/file`)
      setActiveCertificateModal({
        ...cert,
        url,
        fileType: cert.fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image',
      })
    } catch (err) {
      alert(err.message || 'Unable to open certificate document.')
    }
  }

  async function downloadTPCertificate(cert) {
    try {
      await downloadProtectedFile(`/tp/certificates/${cert.id}/file`, cert.fileName || `${cert.name}.pdf`)
    } catch (err) {
      alert(err.message || 'Unable to download certificate.')
    }
  }

  async function viewTPStudentResume(studentId, name) {
    try {
      const url = await protectedFileUrl(`/tp/students/${studentId}/resume`)
      setActiveResume({ url, name })
    } catch (err) {
      alert(err.message || 'Unable to open resume.')
    }
  }

  async function downloadTPStudentResume(studentId, name) {
    try {
      await downloadProtectedFile(`/tp/students/${studentId}/resume`, `${name}-Resume.pdf`)
    } catch (err) {
      alert(err.message || 'Unable to download resume.')
    }
  }

  async function createDrive(drive) {
    await apiRequest('/tp/drives', { method: 'POST', body: drive })
    window.location.href = '/tp'
  }

  async function updateDrive(driveId, drivePayload) {
    const response = await apiRequest(`/tp/drives/${driveId}`, { method: 'PUT', body: drivePayload })
    setDriveData((prev) => prev.map((d) => (d.id === driveId ? response.drive : d)))
    if (activeDrive && activeDrive.id === driveId) {
      setActiveDrive(response.drive)
    }
    return response.drive
  }

  async function applyToDrive(drive) {
    await apiRequest(`/drives/${drive.id}/apply`, { method: 'POST', body: {} })
    window.location.href = '/student'
  }

  async function updateApplicationStatus(applicationId, status) {
    await apiRequest(`/tp/applications/${applicationId}/status`, { method: 'PATCH', body: { status } })
    setApplicants((items) => items.map((item) => item.id === applicationId ? { ...item, status } : item))
  }

  async function requestMentorship(alumniId, message) {
    const response = await apiRequest('/alumni/mentorship-requests', { method: 'POST', body: { alumniId, message } })
    setMentorshipRequests((items) => [response.request, ...items])
  }

  async function updateMentorshipRequest(id, status) {
    const response = await apiRequest(`/alumni/mentorship-requests/${id}`, { method: 'PATCH', body: { status } })
    setMentorshipRequests((items) => items.map((item) => item.id === id ? response.request : item))
  }

  async function createInterviewSlot(slot) {
    const response = await apiRequest('/alumni/interview-slots', { method: 'POST', body: slot })
    setInterviewSlots((items) => [...items, response.slot])
  }

  async function bookInterviewSlot(slotId) {
    await apiRequest(`/alumni/interview-slots/${slotId}/book`, { method: 'POST', body: {} })
    setInterviewSlots((items) => items.filter((item) => item.id !== slotId))
  }

  async function requestReferral(driveId) {
    const response = await apiRequest('/alumni/referrals', { method: 'POST', body: { driveId } })
    setReferrals((items) => [response.referral, ...items])
  }

  async function createForumPost(content, parentId = null) {
    const response = await apiRequest('/alumni/forum', { method: 'POST', body: { content, parentId } })
    if (parentId) {
      setForumPosts((items) => items.map((item) => {
        if (item.id === parentId) {
          const currentReplies = item.repliesList || []
          return {
            ...item,
            replies: (item.replies || 0) + 1,
            repliesList: [...currentReplies, response.post],
          }
        }
        return item
      }))
    } else {
      setForumPosts((items) => [{ ...response.post, repliesList: [], replies: 0 }, ...items])
    }
    return response.post
  }

  async function fetchPostReplies(postId) {
    try {
      const response = await apiRequest(`/alumni/forum/${postId}/replies`)
      if (response?.replies) {
        setForumPosts((items) => items.map((item) => {
          if (item.id === postId) {
            return {
              ...item,
              repliesList: response.replies,
              replies: response.replies.length,
            }
          }
          return item
        }))
        return response.replies
      }
    } catch {
      // Graceful fallback
    }
    return null
  }

  async function saveAlumniProfile(nextProfile) {
    const response = await apiRequest('/alumni/profile', { method: 'PUT', body: nextProfile })
    setUser(response.profile)
    const session = getSession()
    if (session?.token) {
      saveSession({ token: session.token, user: response.profile })
    }
    const mentorRes = await apiRequest('/alumni/mentors').catch(() => ({ mentors: [] }))
    setMentors(mentorRes.mentors || [])
    return response.profile
  }

  async function refreshConnectionRequests() {
    try {
      const response = await apiRequest('/connections/requests')
      setConnectionRequests(response.requests || [])
    } catch {
      // quiet catch
    }
  }

  async function refreshConversations() {
    try {
      const response = await apiRequest('/chat/conversations')
      setConversations(response.conversations || [])
    } catch {
      // quiet catch
    }
  }

  function handleSendConnectionRequest(newRequest) {
    setConnectionRequests((prev) => {
      const rest = prev.filter((r) => r.id !== newRequest.id && r.alumniId !== newRequest.alumniId)
      return [newRequest, ...rest]
    })
    refreshConnectionRequests()
  }

  async function handleUpdateConnectionRequestStatus(id, status) {
    const response = await apiRequest(`/connections/requests/${id}`, {
      method: 'PATCH',
      body: { status },
    })
    setConnectionRequests((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: response.request.status, conversationId: response.request.conversationId } : item))
    )
    if (status === 'Accepted') {
      await refreshConversations()
    }
  }

  let page
  if (path === '/student') page = <StudentDashboard profile={profile} resume={resume} scorecard={scorecard} certificates={certificates} onSaveProfile={saveProfile} onSaveResume={saveResume} onViewResume={viewStudentResume} onSaveScorecard={saveScorecard} onViewScorecard={viewStudentScorecard} onUpdateSemGpa={updateSemGpa} onCreateCertificate={createCertificate} onUpdateCertificate={updateCertificate} onDeleteCertificate={deleteCertificate} onViewCertificate={viewCertificate} applications={applications} />
  else if (path === '/tp') page = <TPCommandCenter driveData={driveData} studentList={studentList} onEditDrive={updateDrive} />
  else if (path === '/tp/create') page = <CreateDrivePage onCreateDrive={createDrive} />
  else if (path.startsWith('/tp/students/')) {
    page = activeStudent ? (
      <TPStudentDetails
        student={activeStudent}
        onViewCertificate={viewTPCertificate}
        onDownloadCertificate={downloadTPCertificate}
        onViewResume={() => viewTPStudentResume(activeStudent.id, activeStudent.name)}
        onDownloadResume={() => downloadTPStudentResume(activeStudent.id, activeStudent.name)}
        onViewScorecard={() => viewTPStudentScorecard(activeStudent.id)}
        onDownloadScorecard={() => downloadTPStudentScorecard(activeStudent.id, activeStudent.name)}
      />
    ) : (
      <main className="workspace-content"><a className="back-link" href="/tp">← <span>T&amp;P Center</span></a><h1>Student not found</h1></main>
    )
  } else if (path.startsWith('/tp/drives/')) {
    page = activeDrive ? <ApplicantReview drive={activeDrive} applicants={applicants} onUpdateStatus={updateApplicationStatus} onViewResume={(id) => protectedFileUrl(`/tp/applications/${id}/resume`)} onReloadApplicants={async () => {
      const applicantResponse = await apiRequest(`/tp/drives/${activeDrive.id}/applicants`)
      setApplicants(applicantResponse.applicants)
    }} onEditDrive={updateDrive} /> : <main className="workspace-content"><a className="back-link" href="/tp">← <span>T&amp;P Center</span></a><h1>Drive not found</h1></main>
  } else if (path === '/alumni') page = <AlumniHub
    activeAlumniTab={alumniTab}
    activeChatConversationId={activeChatConversationId}
    connectionRequests={connectionRequests}
    conversations={conversations}
    driveData={driveData}
    forumPosts={forumPosts}
    interviewSlots={interviewSlots}
    mentors={mentors}
    mentorshipRequests={mentorshipRequests}
    onBookInterview={bookInterviewSlot}
    onCreateForumPost={createForumPost}
    onFetchPostReplies={fetchPostReplies}
    onCreateInterviewSlot={createInterviewSlot}
    onRefreshConnectionRequests={refreshConnectionRequests}
    onRefreshConversations={refreshConversations}
    onRequestMentorship={requestMentorship}
    onRequestReferral={requestReferral}
    onSelectAlumniTab={setAlumniTab}
    onSendConnectionRequest={handleSendConnectionRequest}
    onUpdateAlumniProfile={saveAlumniProfile}
    onUpdateConnectionRequestStatus={handleUpdateConnectionRequestStatus}
    onUpdateMentorshipRequest={updateMentorshipRequest}
    referrals={referrals}
    setActiveChatConversationId={setActiveChatConversationId}
    user={user}
  />
  else if (path === '/notices' || path === '/notice-board') page = <NoticeBoard user={user} profile={profile} driveData={driveData} />
  else if (path === '/analytics' || path === '/placement-stats') page = <PlacementAnalytics user={user} />
  else if (activeDrive) page = <DriveDetail drive={activeDrive} user={user} profile={profile} isApplied={applications.some((application) => application.drive.id === activeDrive.id)} onApply={applyToDrive} />
  else page = <DriveListing driveData={driveData} user={user} profile={profile} />

  return (
    <div className="app-shell">
      <Header activeAlumniTab={alumniTab} onSelectAlumniTab={setAlumniTab} onSignOut={signOut} user={user} theme={theme} onToggleTheme={toggleTheme} />
      {page}
      {activeResume && (
        <div className="resume-viewer-backdrop" role="presentation" onClick={() => setActiveResume(null)}>
          <section aria-label={`${activeResume.name} resume`} aria-modal="true" className="resume-viewer-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
            <header>
              <div><p className="eyebrow-dark">STUDENT RESUME</p><h2>{activeResume.name}</h2></div>
              <button aria-label="Close resume viewer" className="quiet-button" onClick={() => setActiveResume(null)} type="button">Close</button>
            </header>
            <iframe src={activeResume.url} title={`${activeResume.name} resume PDF`} />
          </section>
        </div>
      )}
      <CertificateViewerModal
        activeCertificate={activeCertificateModal}
        onClose={() => {
          if (activeCertificateModal?.url) URL.revokeObjectURL(activeCertificateModal.url)
          setActiveCertificateModal(null)
        }}
        onDownload={downloadTPCertificate}
      />
      <footer className="site-footer">CareerBridge AI — placement intelligence for the campus cell. Scores explain themselves; humans make the calls.</footer>
    </div>
  )
}

export default App

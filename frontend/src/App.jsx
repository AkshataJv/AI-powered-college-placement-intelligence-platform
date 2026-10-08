import { useEffect, useState } from 'react'
import { apiRequest, clearSession, downloadProtectedFile, getSession, protectedFileUrl, saveSession } from './api'
import './App.css'

const branches = ['All branches', 'CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML']
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

function Header({ user, onSignOut }) {
  const roleLinks = user?.role === 'Student'
    ? [{ label: 'My Dashboard', href: '/student' }, { label: 'Alumni Hub', href: '/alumni' }]
    : user?.role === 'T&P Officer'
      ? [{ label: 'T&P Center', href: '/tp' }, { label: 'Create Drive', href: '/tp/create' }]
      : user?.role === 'Alumni'
        ? [{ label: 'Alumni Hub', href: '/alumni' }]
        : []

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          <BrandMark />
          <span>CareerCompass <b>AI</b></span>
        </a>
        <div className="header-actions">
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
        {[{ label: 'Drives', href: '/' }, ...roleLinks].map((item) => (
          <a className={window.location.pathname === item.href ? 'active' : ''} href={item.href} key={item.href}>{item.label}</a>
        ))}
      </nav>
    </>
  )
}

function DriveCard({ drive }) {
  return (
    <article className="drive-card">
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
      <div className="eligibility-tags">
        <span>Min CGPA {drive.cgpa}</span>
        <span>Backlogs ≤ {drive.backlogs}</span>
      </div>
      <div className="skill-list" aria-label="Required skills">
        {drive.skills.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>)}
      </div>
      <div className="drive-card-bottom">
        <span className="deadline-label">Apply by {formatDate(drive.deadline)}</span>
        <a className="text-link" href={`/drives/${drive.id}`}>View &amp; apply <span aria-hidden="true">↗</span></a>
      </div>
    </article>
  )
}

function DriveListing({ driveData }) {
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('All branches')
  const [sort, setSort] = useState('deadline')
  const [deadline, setDeadline] = useState('')

  const visibleDrives = driveData
    .filter((drive) => {
      const searchText = `${drive.company} ${drive.role} ${drive.skills.join(' ')}`.toLowerCase()
      return searchText.includes(query.toLowerCase())
        && (branch === 'All branches' || drive.branches.includes(branch))
        && (!deadline || drive.deadline <= deadline)
    })
    .sort((first, second) => {
      if (sort === 'salary-high') return second.salary - first.salary
      if (sort === 'salary-low') return first.salary - second.salary
      if (sort === 'company') return first.company.localeCompare(second.company)
      return first.deadline.localeCompare(second.deadline)
    })

  return (
    <main className="page-content">
      <section className="hero-panel">
        <div className="hero-content">
          <p className="eyebrow">CareerCompass AI <span>·</span> Placement cell</p>
          <h1>Placement season, decoded.</h1>
          <p className="hero-copy">Every drive shows its eligibility gate up front, every score comes with its full breakdown, and every shortlist is a human decision.</p>
          <div className="hero-stats">
            <span>{visibleDrives.length} open drives</span>
            <span>{new Set(visibleDrives.map((drive) => drive.company)).size} companies hiring</span>
            <span>Top CTC {visibleDrives.length ? `₹${Math.max(...visibleDrives.map((drive) => drive.salary)).toFixed(1)} LPA` : '—'}</span>
          </div>
        </div>
      </section>

      <section className="drive-browser" aria-label="Placement drives">
        <label className="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or role" aria-label="Search company or role" />
        </label>
        <div className="filter-row">
          <div className="branch-filters" role="group" aria-label="Filter by branch">
            {branches.map((item) => (
              <button className={branch === item ? 'branch-chip selected' : 'branch-chip'} key={item} onClick={() => setBranch(item)} type="button">{item}</button>
            ))}
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
          {visibleDrives.length ? visibleDrives.map((drive) => <DriveCard drive={drive} key={drive.id} />) : (
            <div className="empty-state">
              <span className="empty-icon">⌕</span>
              <h2>{driveData.length ? 'No drives match your filters' : 'No open drives yet'}</h2>
              <p>{driveData.length ? 'Try another company, role, or branch.' : 'Placement drives will appear here after a T&P officer publishes them.'}</p>
              {driveData.length > 0 && <button type="button" onClick={() => { setQuery(''); setBranch('All branches'); setDeadline('') }}>Clear filters</button>}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function DriveDetail({ drive, user, profile, isApplied, onApply }) {
  const eligible = profile
    && profile.cgpa >= drive.cgpa
    && profile.backlogs <= drive.backlogs
    && drive.branches.includes(profile.branch)

  return (
    <main className="detail-content">
      <a className="back-link" href="/">← <span>All drives</span></a>
      <article className="detail-card">
        <div className="detail-heading">
          <div>
            <p className="company-name">{drive.company}</p>
            <h1>{drive.role}</h1>
          </div>
          <div className="detail-compensation"><span className="status-pill">Open</span><strong>₹{drive.salary.toFixed(1)} LPA</strong></div>
        </div>
        <div className="detail-facts">
          <div><span>Min CGPA</span><strong>{drive.cgpa} / 10</strong></div>
          <div><span>Max backlogs</span><strong>{drive.backlogs}</strong></div>
          <div><span>Eligible branches</span><strong>{drive.branches.join(', ')}</strong></div>
          <div><span>Apply by</span><strong>{formatDate(drive.deadline)}</strong></div>
        </div>
        <p className="detail-description">{drive.description}</p>
        <SkillSection title="Required skills" skills={drive.skills} />
        <SkillSection title="Preferred skills" skills={drive.preferred} tone="green" />
        <SkillSection title="JD keywords" skills={drive.keywords} tone="neutral" />
        {user?.role === 'Student' && (
          <div className="apply-row">
            <span>{isApplied ? 'Your application is in the review queue.' : eligible ? 'Applications are scored transparently. Shortlisting remains a human decision.' : 'Your current profile does not meet this drive’s eligibility requirements.'}</span>
            <button className="primary-button apply-button" disabled={isApplied || !eligible} onClick={() => onApply(drive)} type="button">{isApplied ? 'Applied' : eligible ? 'Apply to this drive' : 'Not eligible'}</button>
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

function StudentDashboard({ profile, resume, certificates = [], onSaveProfile, onSaveResume, onViewResume, onCreateCertificate, onUpdateCertificate, onDeleteCertificate, onViewCertificate, applications: applicationData }) {
  const [editing, setEditing] = useState(false)
  const [selectedResume, setSelectedResume] = useState(null)
  const [resumeError, setResumeError] = useState('')
  const [notice, setNotice] = useState('')
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

  return (
    <main className="workspace-content">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow-dark">STUDENT WORKSPACE</p>
          <h1>Hi {profile.name} — your placement cockpit</h1>
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
                <div><dt>CGPA</dt><dd>{Number(profile.cgpa).toFixed(2)} / 10.0</dd></div>
                <div><dt>Backlogs</dt><dd>{profile.backlogs}</dd></div>
                <div><dt>Certificates</dt><dd>{certificates.length}</dd></div>
              </dl>
              <p className="section-label">Skills</p>
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
            const eligible = Number(profile.cgpa) >= drive.cgpa && Number(profile.backlogs) <= drive.backlogs && drive.branches.includes(profile.branch)
            const missingSkills = drive.skills.filter((skill) => !profile.skills.some((item) => item.toLowerCase() === skill.toLowerCase()))
            return (
              <article className="application-card" key={drive.id}>
                <div className="application-header">
                  <div><p className="company-name">{drive.company}</p><h3>{drive.role}</h3><p className="deadline-label">Applied {applied}</p></div>
                  <span className={`status-pill ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
                </div>
                <div className="application-score-row">
                  <div><span className="section-label">Match score</span><strong>{score?.score.toFixed(1) || '28.0'} <small>/ 100</small></strong></div>
                  <span className={eligible ? 'eligibility-status eligible' : 'eligibility-status ineligible'}>{eligible ? 'Eligible' : 'Not eligible'}</span>
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

function TPStudentDetails({ student, onViewCertificate, onDownloadCertificate, onViewResume, onDownloadResume }) {
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
            <div><dt>Certificates</dt><dd>{certCount}</dd></div>
          </dl>
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

function TPCommandCenter({ driveData, studentList = [] }) {
  const [tab, setTab] = useState('drives')
  const [query, setQuery] = useState('')
  const [studentQuery, setStudentQuery] = useState('')

  const filteredDrives = driveData.filter((drive) => `${drive.company} ${drive.role}`.toLowerCase().includes(query.toLowerCase()))
  const filteredStudents = studentList.filter((student) => `${student.name} ${student.email} ${student.branch}`.toLowerCase().includes(studentQuery.toLowerCase()))
  const openDrives = driveData.filter((drive) => drive.status !== 'Closed')
  const applicationCount = driveData.reduce((sum, drive) => sum + (drive.applicantCount || 0), 0)

  return (
    <main className="workspace-content">
      <div className="workspace-heading command-heading">
        <div>
          <p className="eyebrow-dark">PLACEMENT CELL</p>
          <h1>T&amp;P Command Center</h1>
          <p>Post drives, review student certificates, and evaluate talent pools for placement.</p>
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
                  <th>Apply by</th>
                  <th>Status</th>
                  <th>Applicants</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredDrives.map((drive) => (
                  <tr key={drive.id}>
                    <td className="table-company">{drive.company}</td>
                    <td>{drive.role}</td>
                    <td>₹{drive.salary.toFixed(1)} LPA</td>
                    <td>{formatDate(drive.deadline)}</td>
                    <td><span className="status-pill">{drive.status}</span></td>
                    <td>{drive.applicantCount || 0}</td>
                    <td><a className="text-link" href={`/tp/drives/${drive.id}`}>Review pool ↗</a></td>
                  </tr>
                ))}
                {filteredDrives.length === 0 && (
                  <tr><td colSpan="7" className="empty-table">No drives match this search.</td></tr>
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
                placeholder="Search name, branch or email"
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
                    <td>{Number(student.cgpa).toFixed(2)}</td>
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
                  <tr><td colSpan="7" className="empty-table">No students match this search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
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
  async function submitDrive(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const drive = {
      company: fields.get('company'),
      role: fields.get('role'),
      salary: Number(fields.get('salary')),
      cgpa: Number(fields.get('cgpa')),
      backlogs: Number(fields.get('backlogs')),
      branches: fields.getAll('branches'),
      skills: fields.get('skills').split(',').map((skill) => skill.trim()).filter(Boolean),
      preferred: fields.get('preferred').split(',').map((skill) => skill.trim()).filter(Boolean),
      keywords: fields.get('keywords').split(',').map((skill) => skill.trim()).filter(Boolean),
      deadline: fields.get('deadline'),
      description: fields.get('description'),
      status: 'Open',
    }
    if (!drive.branches.length || !drive.skills.length) {
      setError('Choose at least one eligible branch and add one required skill.')
      return
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
      <div className="workspace-heading"><div><p className="eyebrow-dark">NEW OPPORTUNITY</p><h1>Create a placement drive</h1><p>Set transparent eligibility gates before students apply.</p></div></div>
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
          <label>Minimum CGPA<input max="10" min="0" name="cgpa" required step="0.1" type="number" /></label>
          <label>Maximum active backlogs<input min="0" name="backlogs" required type="number" /></label>
        </div>
        <fieldset className="branch-picker"><legend>Eligible branches</legend><div>{branches.slice(1).map((branch) => <label key={branch}><input name="branches" type="checkbox" value={branch} />{branch}</label>)}</div></fieldset>
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

function ApplicantReview({ drive, applicants, onUpdateStatus, onViewResume }) {
  const [query, setQuery] = useState('')
  const visible = applicants.filter((applicant) => `${applicant.name} ${applicant.branch}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.score - a.score)
  const [resumeError, setResumeError] = useState('')
  const [activeResume, setActiveResume] = useState(null)

  useEffect(() => () => {
    if (activeResume) URL.revokeObjectURL(activeResume.url)
  }, [activeResume])

  async function openResume(applicantId) {
    try {
      const url = await onViewResume(applicantId)
      setActiveResume({ url, name: applicants.find((applicant) => applicant.id === applicantId)?.name || 'Applicant' })
    } catch (error) {
      setResumeError(error.message)
    }
  }

  return (
    <main className="workspace-content">
      <a className="back-link" href="/tp">← <span>T&amp;P Center</span></a>
      <div className="workspace-heading"><div><p className="eyebrow-dark">APPLICANT REVIEW</p><h1>{drive.company} · {drive.role}</h1><p>Review match signals and eligibility, then make the shortlist decision.</p></div></div>
      <div className="metric-grid three-metrics"><Metric label="Applicants" value={applicants.length} /><Metric label="Eligible" value={applicants.filter((applicant) => applicant.cgpa >= drive.cgpa && applicant.backlogs <= drive.backlogs && drive.branches.includes(applicant.branch)).length} /><Metric label="Shortlisted" value={applicants.filter((applicant) => applicant.status === 'Shortlisted').length} /></div>
      <section className="workspace-panel">
        <div className="section-heading-row"><div><p className="eyebrow-dark">RANKED POOL</p><h2>Applicants</h2></div><label className="compact-search"><span className="sr-only">Search applicants</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search name or branch" value={query} /></label></div>
        {resumeError && <p className="form-error" role="alert">{resumeError}</p>}
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Rank</th><th>Student</th><th>Branch</th><th>CGPA</th><th>Match score</th><th>Eligibility</th><th>Resume</th><th>Certificates</th><th>Applied</th><th>Decision</th></tr></thead><tbody>
          {visible.map((applicant, index) => {
            const eligible = applicant.cgpa >= drive.cgpa && applicant.backlogs <= drive.backlogs && drive.branches.includes(applicant.branch)
            return <tr key={applicant.id}><td className="rank-cell">{String(index + 1).padStart(2, '0')}</td><td className="applicant-identity"><a className="text-link" href={`/tp/students/${applicant.studentId}`}><strong>{applicant.name}</strong></a><small>{applicant.email}</small></td><td>{applicant.branch}</td><td>{applicant.cgpa.toFixed(1)}</td><td><strong>{applicant.score.toFixed(1)}</strong></td><td><span className={`eligibility-status ${eligible ? 'eligible' : 'ineligible'}`}>{eligible ? 'Eligible' : 'Not eligible'}</span></td><td>{applicant.hasResume ? <button className="resume-open-link" onClick={() => openResume(applicant.id)} type="button">View PDF ↗</button> : <span className="resume-missing">Not uploaded</span>}</td><td><a className="text-link" href={`/tp/students/${applicant.studentId}`}>{applicant.certificateCount || 0} cert{applicant.certificateCount === 1 ? '' : 's'} ↗</a></td><td>{formatDate(applicant.appliedAt)}</td><td><select aria-label={`Decision for ${applicant.name}`} onChange={(event) => onUpdateStatus(applicant.id, event.target.value)} value={applicant.status}><option>Under review</option><option>Shortlisted</option><option>Selected</option><option>Rejected</option></select></td></tr>
          })}
          {visible.length === 0 && <tr><td className="empty-table" colSpan="10">No applicants match this search.</td></tr>}
        </tbody></table></div>
        <p className="decision-note">Shortlisting is a human decision. Match scores explain the profile; they do not make the decision.</p>
      </section>
      {activeResume && <div className="resume-viewer-backdrop" role="presentation" onClick={() => setActiveResume(null)}><section aria-label={`${activeResume.name} resume`} aria-modal="true" className="resume-viewer-dialog" onClick={(event) => event.stopPropagation()} role="dialog"><header><div><p className="eyebrow-dark">APPLICANT RESUME</p><h2>{activeResume.name}</h2></div><button aria-label="Close resume viewer" className="quiet-button" onClick={() => setActiveResume(null)} type="button">Close</button></header><iframe src={activeResume.url} title={`${activeResume.name} resume PDF`} /></section></div>}
    </main>
  )
}

function AlumniHub({ driveData, user, mentors, mentorshipRequests, interviewSlots, referrals, forumPosts, onRequestMentorship, onUpdateMentorshipRequest, onBookInterview, onCreateInterviewSlot, onRequestReferral, onCreateForumPost }) {
  const [tab, setTab] = useState('Mentorship')
  const [message, setMessage] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [actionError, setActionError] = useState('')
  const [slotFormOpen, setSlotFormOpen] = useState(false)
  const isAlumni = user.role === 'Alumni'
  const outgoingRequests = mentorshipRequests.filter((request) => request.student_id === user.id)
  const incomingRequests = mentorshipRequests.filter((request) => request.alumni_id === user.id)
  const tabs = ['Mentorship', 'Mock interviews', 'Referral desk', 'Forum']

  async function postMessage(event) {
    event.preventDefault()
    if (!message.trim()) return
    try {
      await onCreateForumPost(message.trim(), replyTo)
      setMessage('')
      setReplyTo(null)
      setActionError('')
    } catch (error) {
      setActionError(error.message)
    }
  }

  return (
    <main className="workspace-content alumni-workspace">
      <section className="alumni-hero">
        <div><p className="eyebrow">ALUMNI CONNECT HUB</p><h1>Welcome back to campus</h1><p>Share what you’ve learned. Help the next class take its next step.</p></div>
        <a className="hero-action" href="/">Browse open drives ↗</a>
      </section>
      <div className="alumni-stats"><span><strong>{mentors.length}</strong> alumni profiles</span><span><strong>{interviewSlots.length}</strong> open interview slots</span><span><strong>{driveData.length}</strong> open drives</span></div>
      <div className="tab-bar" role="tablist" aria-label="Alumni tools">
        {tabs.map((item) => <button aria-selected={tab === item} className={tab === item ? 'workspace-tab active' : 'workspace-tab'} key={item} onClick={() => setTab(item)} role="tab" type="button">{item}</button>)}
      </div>

      {tab === 'Mentorship' && <section className="alumni-content"><div className="section-heading-row"><div><p className="eyebrow-dark">PEER NETWORK</p><h2>{isAlumni ? 'Mentorship requests' : 'Find a mentor'}</h2></div><span className="muted-count">{isAlumni ? `${incomingRequests.length} requests received` : `${outgoingRequests.length} requests sent`}</span></div>{isAlumni ? <div className="slot-list">{incomingRequests.map((request) => <article className="slot-row" key={request.id}><div><p className="eyebrow-dark">{request.status}</p><h3>{request.student_name}</h3><p>{request.message || 'Requested a mentorship connection.'}</p></div><div className="action-pair"><button className="quiet-button" disabled={request.status !== 'Pending'} onClick={async () => { try { await onUpdateMentorshipRequest(request.id, 'Accepted') } catch (error) { setActionError(error.message) } }} type="button">Accept</button><button className="quiet-button" disabled={request.status !== 'Pending'} onClick={async () => { try { await onUpdateMentorshipRequest(request.id, 'Declined') } catch (error) { setActionError(error.message) } }} type="button">Decline</button></div></article>)}{incomingRequests.length === 0 && <div className="empty-state"><h2>No mentorship requests yet</h2><p>Student requests will appear here.</p></div>}</div> : <div className="mentor-grid">{mentors.filter((mentor) => mentor.id !== user.id).map((mentor) => { const request = outgoingRequests.find((item) => item.alumni_id === mentor.id); return <article className="mentor-card" key={mentor.id}><div className="mentor-avatar">{mentor.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><p className="eyebrow-dark">{mentor.company || 'Alumni'}</p><h3>{mentor.name}</h3><p className="mentor-role">{mentor.job_title || 'Alumni mentor'}</p><button className="quiet-button" disabled={Boolean(request)} onClick={async () => { try { await onRequestMentorship(mentor.id, '') } catch (error) { setActionError(error.message) } }} type="button">{request ? request.status : 'Request mentorship'}</button></article> })}{mentors.length <= 1 && <div className="empty-state"><h2>No alumni profiles yet</h2><p>Alumni who create an account will be available to connect here.</p></div>}</div>}{actionError && <p className="form-error" role="alert">{actionError}</p>}</section>}

      {tab === 'Mock interviews' && <section className="alumni-content"><div className="section-heading-row"><div><p className="eyebrow-dark">PRACTICE TOGETHER</p><h2>{isAlumni ? 'Your interview slots' : 'Mock interview slots'}</h2></div>{isAlumni && <button className="quiet-button" onClick={() => setSlotFormOpen(!slotFormOpen)} type="button">{slotFormOpen ? 'Cancel' : '＋ Add slot'}</button>}</div>{slotFormOpen && <form className="slot-create-form" onSubmit={async (event) => { event.preventDefault(); const fields = new FormData(event.currentTarget); try { await onCreateInterviewSlot({ topic: fields.get('topic'), startsAt: fields.get('startsAt'), mode: 'Video call' }); setSlotFormOpen(false); setActionError('') } catch (error) { setActionError(error.message) } }}><label>Interview focus<input name="topic" placeholder="System design, product case…" required /></label><label>Start time<input name="startsAt" required type="datetime-local" /></label><button className="primary-button compact-button" type="submit">Publish slot</button></form>}<div className="slot-list">{interviewSlots.filter((slot) => !isAlumni || slot.alumni_id === user.id).map((slot) => <article className="slot-row" key={slot.id}><div><p className="eyebrow-dark">{slot.topic}</p><h3>{slot.alumni_name}</h3><p>{new Date(slot.starts_at).toLocaleString()} <span>·</span> {slot.mode} {slot.company ? `· ${slot.company}` : ''}</p></div>{!isAlumni && <button className="quiet-button" onClick={async () => { try { await onBookInterview(slot.id) } catch (error) { setActionError(error.message) } }} type="button">Book slot</button>}</article>)}{interviewSlots.length === 0 && <div className="empty-state"><h2>No interview slots available</h2><p>Alumni can publish a time for a mock interview here.</p></div>}</div>{actionError && <p className="form-error" role="alert">{actionError}</p>}</section>}

      {tab === 'Referral desk' && <ReferralDesk driveData={driveData} referrals={referrals} isAlumni={isAlumni} onRequestReferral={onRequestReferral} />}

      {tab === 'Forum' && <section className="alumni-content"><div className="section-heading-row"><div><p className="eyebrow-dark">CAMPUS CONVERSATIONS</p><h2>Alumni forum</h2></div><span className="muted-count">{forumPosts.length} discussions</span></div><form className="forum-compose" onSubmit={postMessage}><label className="sr-only" htmlFor="forum-post">Start a discussion</label><textarea id="forum-post" onChange={(event) => setMessage(event.target.value)} placeholder={replyTo ? 'Write your reply…' : 'Share a question, insight, or opportunity…'} rows="2" value={message} /><button className="primary-button compact-button" type="submit">{replyTo ? 'Reply' : 'Post'}</button></form>{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="forum-list">{forumPosts.map((post) => <article className="forum-post" key={post.id}><div className="forum-post-meta"><strong>{post.author}</strong><span>{new Date(post.createdAt).toLocaleDateString()}</span></div><p>{post.content}</p><button className="reply-button" onClick={() => { setReplyTo(post.id); setMessage('') }} type="button">{post.replies} replies · Reply</button></article>)}</div>{forumPosts.length === 0 && <div className="empty-state"><h2>Start the first discussion</h2><p>Questions and advice posted by your campus community will appear here.</p></div>}</section>}
    </main>
  )
}

function ReferralDesk({ driveData, referrals, isAlumni, onRequestReferral }) {
  return (
    <section className="alumni-content"><div className="section-heading-row"><div><p className="eyebrow-dark">OPEN OPPORTUNITIES</p><h2>Referral desk</h2></div><span className="muted-count">{referrals.length} requests started</span></div>{driveData.length ? <div className="referral-list">{driveData.map((drive) => { const referral = referrals.find((item) => item.drive_id === drive.id); return <article className="referral-row" key={drive.id}><div><p className="company-name">{drive.company}</p><h3>{drive.role}</h3><p>₹{drive.salary.toFixed(1)} LPA <span>·</span> Apply by {formatDate(drive.deadline)}{referral ? ` · ${referral.status}` : ''}</p></div>{isAlumni ? <button className="quiet-button" disabled={Boolean(referral)} onClick={() => onRequestReferral(drive.id)} type="button">{referral ? 'Request started' : 'Start referral request'}</button> : <a className="text-link" href={`/drives/${drive.id}`}>View drive ↗</a>}</article> })}</div> : <div className="empty-state"><h2>No open drives</h2><p>Referral opportunities will appear when T&amp;P officers publish drives.</p></div>}</section>
  )
}

function AuthPage({ mode, onAuthenticate }) {
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
      <section className="auth-panel">
        <h1>{isRegister ? 'Create your account' : 'Sign in'}</h1>
        <p className="auth-intro">{isRegister ? 'Create an account for your campus role.' : 'Sign in to your CareerCompass account.'}</p>
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
  const [user, setUser] = useState(() => getSession().user)
  const [profile, setProfile] = useState(null)
  const [resume, setResume] = useState(null)
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
  const [interviewSlots, setInterviewSlots] = useState([])
  const [referrals, setReferrals] = useState([])
  const [forumPosts, setForumPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
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
          const [profileResponse, resumeResponse, certificateResponse, applicationResponse] = await Promise.all([
            apiRequest('/student/profile'),
            apiRequest('/student/resume'),
            apiRequest('/student/certificates'),
            apiRequest('/student/applications'),
          ])
          if (cancelled) return
          setProfile(profileResponse.profile)
          setResume(resumeResponse.resume)
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
          const [mentorResponse, requestResponse, slotResponse, referralResponse, forumResponse] = await Promise.all([
            apiRequest('/alumni/mentors'),
            apiRequest('/alumni/mentorship-requests'),
            apiRequest('/alumni/interview-slots'),
            apiRequest('/alumni/referrals'),
            apiRequest('/alumni/forum'),
          ])
          if (cancelled) return
          setMentors(mentorResponse.mentors)
          setMentorshipRequests(requestResponse.requests)
          setInterviewSlots(slotResponse.slots)
          setReferrals(referralResponse.referrals)
          setForumPosts(forumResponse.posts)
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

  if (isAuth) return <AuthPage mode={path.slice(1)} onAuthenticate={authenticate} />
  if (loading) return <main className="route-loading">Loading CareerCompass…</main>
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
      setForumPosts((items) => items.map((item) => item.id === parentId ? { ...item, replies: item.replies + 1 } : item))
    } else {
      setForumPosts((items) => [response.post, ...items])
    }
  }

  let page
  if (path === '/student') page = <StudentDashboard profile={profile} resume={resume} certificates={certificates} onSaveProfile={saveProfile} onSaveResume={saveResume} onViewResume={viewStudentResume} onCreateCertificate={createCertificate} onUpdateCertificate={updateCertificate} onDeleteCertificate={deleteCertificate} onViewCertificate={viewCertificate} applications={applications} />
  else if (path === '/tp') page = <TPCommandCenter driveData={driveData} studentList={studentList} />
  else if (path === '/tp/create') page = <CreateDrivePage onCreateDrive={createDrive} />
  else if (path.startsWith('/tp/students/')) {
    page = activeStudent ? (
      <TPStudentDetails
        student={activeStudent}
        onViewCertificate={viewTPCertificate}
        onDownloadCertificate={downloadTPCertificate}
        onViewResume={() => viewTPStudentResume(activeStudent.id, activeStudent.name)}
        onDownloadResume={() => downloadTPStudentResume(activeStudent.id, activeStudent.name)}
      />
    ) : (
      <main className="workspace-content"><a className="back-link" href="/tp">← <span>T&amp;P Center</span></a><h1>Student not found</h1></main>
    )
  } else if (path.startsWith('/tp/drives/')) {
    page = activeDrive ? <ApplicantReview drive={activeDrive} applicants={applicants} onUpdateStatus={updateApplicationStatus} onViewResume={(id) => protectedFileUrl(`/tp/applications/${id}/resume`)} /> : <main className="workspace-content"><a className="back-link" href="/tp">← <span>T&amp;P Center</span></a><h1>Drive not found</h1></main>
  } else if (path === '/alumni') page = <AlumniHub driveData={driveData} user={user} mentors={mentors} mentorshipRequests={mentorshipRequests} interviewSlots={interviewSlots} referrals={referrals} forumPosts={forumPosts} onRequestMentorship={requestMentorship} onUpdateMentorshipRequest={updateMentorshipRequest} onBookInterview={bookInterviewSlot} onCreateInterviewSlot={createInterviewSlot} onRequestReferral={requestReferral} onCreateForumPost={createForumPost} />
  else if (activeDrive) page = <DriveDetail drive={activeDrive} user={user} profile={profile} isApplied={applications.some((application) => application.drive.id === activeDrive.id)} onApply={applyToDrive} />
  else page = <DriveListing driveData={driveData} />

  return (
    <div className="app-shell">
      <Header user={user} onSignOut={signOut} />
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
      <footer className="site-footer">CareerCompass AI — placement intelligence for the campus cell. Scores explain themselves; humans make the calls.</footer>
    </div>
  )
}

export default App

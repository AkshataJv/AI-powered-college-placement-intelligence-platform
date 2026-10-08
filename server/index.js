import bcrypt from 'bcryptjs'
import 'dotenv/config'
import express from 'express'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { db, uploadDirectory } from './db.js'

const app = express()
const port = Number(process.env.API_PORT || 3001)
const jwtSecret = process.env.JWT_SECRET || 'career-compass-local-development-secret-change-me'
const host = process.env.API_HOST || '127.0.0.1'
const branches = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML']

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production.')
}

app.use(express.json({ limit: '1mb' }))

function parseJson(value, fallback = []) {
  try { return JSON.parse(value || JSON.stringify(fallback)) } catch { return fallback }
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    branch: row.branch,
    cgpa: row.cgpa,
    backlogs: row.backlogs,
    certifications: row.certifications,
    skills: parseJson(row.skills_json),
    company: row.company,
    jobTitle: row.job_title,
  }
}

function publicDrive(row) {
  return {
    id: row.drive_id || row.id,
    company: row.company,
    role: row.role,
    salary: row.salary,
    cgpa: row.min_cgpa,
    backlogs: row.max_backlogs,
    branches: parseJson(row.branches_json),
    skills: parseJson(row.skills_json),
    preferred: parseJson(row.preferred_json),
    keywords: parseJson(row.keywords_json),
    deadline: row.deadline,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
  }
}

function publicCertificate(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    issuer: row.issuer,
    issueDate: row.issue_date,
    credentialId: row.credential_id || '',
    credentialUrl: row.credential_url || '',
    description: row.description || '',
    fileName: row.file_name || '',
    fileSize: row.file_size || 0,
    uploadedAt: row.uploaded_at,
    hasFile: Boolean(row.stored_name),
  }
}

function hasValidCertificateSignature(file) {
  const descriptor = fs.openSync(file.path, 'r')
  const signature = Buffer.alloc(8)
  let bytesRead
  try {
    bytesRead = fs.readSync(descriptor, signature, 0, signature.length, 0)
  } finally {
    fs.closeSync(descriptor)
  }

  const extension = path.extname(file.originalname).toLowerCase()
  if (extension === '.pdf') return bytesRead >= 5 && signature.subarray(0, 5).toString() === '%PDF-'
  if (extension === '.png') return bytesRead === 8 && signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (extension === '.jpg' || extension === '.jpeg') return bytesRead >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
  return false
}

function getDrive(id) {
  return db.prepare('SELECT * FROM drives WHERE id = ?').get(id)
}

function scoreApplication(drive, profile) {
  const skills = parseJson(drive.skills_json)
  const preferred = parseJson(drive.preferred_json)
  const keywords = parseJson(drive.keywords_json)
  const studentSkills = profile.skills.map((skill) => skill.toLowerCase())
  const requiredMatches = skills.filter((skill) => studentSkills.includes(skill.toLowerCase())).length
  const preferredMatches = preferred.filter((skill) => studentSkills.includes(skill.toLowerCase())).length
  const profileText = `${studentSkills.join(' ')} ${profile.summary || ''}`.toLowerCase()
  const keywordMatches = keywords.filter((keyword) => profileText.includes(keyword.toLowerCase())).length
  const required = skills.length ? requiredMatches / skills.length * 50 : 50
  const preferredScore = preferred.length ? preferredMatches / preferred.length * 20 : 20
  const keywordScore = keywords.length ? keywordMatches / keywords.length * 15 : 15
  const completeness = Math.min(8, profile.cgpa) + Math.min(5, profile.skills.length / 2) + Math.min(2, profile.certifications)
  return {
    score: Math.round((required + preferredScore + keywordScore + completeness) * 10) / 10,
    required,
    requiredMatches: `${requiredMatches} of ${skills.length}`,
    preferred: preferredScore,
    preferredMatches: `${preferredMatches} of ${preferred.length}`,
    keywords: keywordScore,
    keywordMatches: `${keywordMatches} of ${keywords.length}`,
    completeness,
  }
}

function requireAuth(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' })
  try {
    const decoded = jwt.verify(token, jwtSecret)
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.sub)
    if (!row) return res.status(401).json({ error: 'Your account could not be found.' })
    req.user = publicUser(row)
    next()
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' })
    next()
  }
}

function requireOwnedDrive(driveId, ownerId) {
  return db.prepare('SELECT * FROM drives WHERE id = ? AND owner_id = ?').get(driveId, ownerId)
}

function validateDrive(input) {
  const errors = []
  if (!String(input.company || '').trim()) errors.push('Company is required.')
  if (!String(input.role || '').trim()) errors.push('Role title is required.')
  if (!Number.isFinite(Number(input.salary)) || Number(input.salary) <= 0) errors.push('CTC must be greater than zero.')
  if (!Number.isFinite(Number(input.cgpa)) || Number(input.cgpa) < 0 || Number(input.cgpa) > 10) errors.push('Minimum CGPA must be between 0 and 10.')
  if (!Number.isInteger(Number(input.backlogs)) || Number(input.backlogs) < 0) errors.push('Maximum backlogs must be zero or more.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline || '')) errors.push('A valid application deadline is required.')
  if (!String(input.description || '').trim()) errors.push('Role description is required.')
  if (!Array.isArray(input.branches) || !input.branches.length || input.branches.some((branch) => !branches.includes(branch))) errors.push('Choose at least one valid branch.')
  for (const key of ['skills', 'preferred', 'keywords']) {
    if (!Array.isArray(input[key]) || input[key].some((value) => typeof value !== 'string')) errors.push(`${key} must be a list of text values.`)
  }
  if (!Array.isArray(input.skills) || !input.skills.length) errors.push('Add at least one required skill.')
  return errors
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: 'sqlite' }))

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, branch, cgpa, backlogs, certifications, skills, company, jobTitle } = req.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!String(name || '').trim() || !normalizedEmail || !String(password || '').trim()) return res.status(400).json({ error: 'Name, email, and password are required.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  if (!['Student', 'T&P Officer', 'Alumni'].includes(role)) return res.status(400).json({ error: 'Choose a valid account role.' })
  if (role === 'Student') {
    if (!branches.includes(branch)) return res.status(400).json({ error: 'Choose a valid branch.' })
    if (!Number.isFinite(Number(cgpa)) || Number(cgpa) < 0 || Number(cgpa) > 10) return res.status(400).json({ error: 'CGPA must be between 0 and 10.' })
    if (!Number.isInteger(Number(backlogs)) || Number(backlogs) < 0) return res.status(400).json({ error: 'Backlogs must be zero or more.' })
  }
  const id = randomUUID()
  try {
    db.prepare(`INSERT INTO users (id, name, email, password_hash, role, branch, cgpa, backlogs, certifications, skills_json, company, job_title)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, String(name).trim(), normalizedEmail, bcrypt.hashSync(String(password), 12), role,
        branches.includes(branch) ? branch : 'CSE', role === 'Student' ? Number(cgpa) || 0 : 0,
        role === 'Student' ? Math.max(0, Number(backlogs) || 0) : 0,
        role === 'Student' ? Math.max(0, Number(certifications) || 0) : 0,
        JSON.stringify(Array.isArray(skills) ? skills : []), String(company || '').trim(), String(jobTitle || '').trim())
    const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id))
    const token = jwt.sign({ sub: id }, jwtSecret, { expiresIn: '7d' })
    return res.status(201).json({ user, token })
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'An account with this email already exists.' })
    return res.status(500).json({ error: 'Could not create the account.' })
  }
})

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' })
  return res.json({ user: publicUser(row), token: jwt.sign({ sub: row.id }, jwtSecret, { expiresIn: '7d' }) })
})

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }))

app.get('/api/drives', (_req, res) => {
  const rows = db.prepare("SELECT * FROM drives WHERE status = 'Open' AND deadline >= date('now') ORDER BY deadline ASC").all()
  res.json({ drives: rows.map(publicDrive) })
})

app.get('/api/drives/:id', (req, res) => {
  const row = db.prepare("SELECT * FROM drives WHERE id = ? AND status = 'Open'").get(req.params.id)
  if (!row) return res.status(404).json({ error: 'This drive is no longer available.' })
  return res.json({ drive: publicDrive(row) })
})

app.get('/api/student/profile', requireAuth, requireRole('Student'), (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.json({ profile: publicUser(row) })
})

app.put('/api/student/profile', requireAuth, requireRole('Student'), (req, res) => {
  const { name, branch, cgpa, backlogs, certifications, skills } = req.body || {}
  if (!String(name || '').trim() || !branches.includes(branch)) return res.status(400).json({ error: 'Name and a valid branch are required.' })
  if (!Number.isFinite(Number(cgpa)) || Number(cgpa) < 0 || Number(cgpa) > 10) return res.status(400).json({ error: 'CGPA must be between 0 and 10.' })
  if (!Number.isInteger(Number(backlogs)) || Number(backlogs) < 0) return res.status(400).json({ error: 'Backlogs must be zero or more.' })
  if (!Array.isArray(skills) || skills.some((skill) => typeof skill !== 'string')) return res.status(400).json({ error: 'Skills must be a list of text values.' })
  db.prepare('UPDATE users SET name = ?, branch = ?, cgpa = ?, backlogs = ?, certifications = ?, skills_json = ? WHERE id = ?')
    .run(String(name).trim(), branch, Number(cgpa), Number(backlogs), Math.max(0, Number(certifications) || 0), JSON.stringify(skills.map((skill) => skill.trim()).filter(Boolean)), req.user.id)
  res.json({ profile: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) })
})

app.post('/api/student/resume', requireAuth, requireRole('Student'), (req, res) => {
  upload.single('resume')(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Resume upload failed.' })
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF resume to upload.' })
    const descriptor = fs.openSync(req.file.path, 'r')
    const signature = Buffer.alloc(5)
    fs.readSync(descriptor, signature, 0, signature.length, 0)
    fs.closeSync(descriptor)
    if (signature.toString() !== '%PDF-') {
      fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({ error: 'The uploaded file is not a valid PDF.' })
    }
    const previous = db.prepare('SELECT stored_name FROM resumes WHERE student_id = ?').get(req.user.id)
    db.prepare(`INSERT INTO resumes (student_id, original_name, stored_name, size_bytes, uploaded_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(student_id) DO UPDATE SET original_name = excluded.original_name, stored_name = excluded.stored_name, size_bytes = excluded.size_bytes, uploaded_at = datetime('now')`)
      .run(req.user.id, path.basename(req.file.originalname), req.file.filename, req.file.size)
    if (previous?.stored_name) fs.rm(path.join(uploadDirectory, previous.stored_name), { force: true }, () => {})
    return res.status(201).json({ resume: { name: path.basename(req.file.originalname), size: req.file.size, uploadedAt: new Date().toISOString() } })
  })
})

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, _file, callback) => callback(null, `${randomUUID()}.pdf`),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf' || file.mimetype !== 'application/pdf') return callback(new Error('Choose a PDF resume.'))
    callback(null, true)
  },
})

const certificateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase()
      callback(null, `${randomUUID()}${extension}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const allowedExt = ['.pdf', '.jpg', '.jpeg', '.png']
    const allowedMime = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowedExt.includes(ext) || !allowedMime.includes(file.mimetype)) {
      return callback(new Error('Certificate files must be PDF, JPG, JPEG, or PNG.'))
    }
    callback(null, true)
  },
})

app.get('/api/student/resume', requireAuth, requireRole('Student'), (req, res) => {
  const resume = db.prepare('SELECT original_name, size_bytes, uploaded_at FROM resumes WHERE student_id = ?').get(req.user.id)
  res.json({ resume: resume ? { name: resume.original_name, size: resume.size_bytes, uploadedAt: resume.uploaded_at } : null })
})

app.get('/api/student/resume/file', requireAuth, requireRole('Student'), (req, res) => {
  const resume = db.prepare('SELECT original_name, stored_name FROM resumes WHERE student_id = ?').get(req.user.id)
  if (!resume) return res.status(404).json({ error: 'No resume has been uploaded.' })
  res.set('Content-Type', 'application/pdf')
  res.set('Content-Disposition', `inline; filename="${path.basename(resume.original_name).replace(/"/g, '')}"`)
  res.set('X-Content-Type-Options', 'nosniff')
  return res.sendFile(path.join(uploadDirectory, resume.stored_name))
})

app.get('/api/student/certificates', requireAuth, requireRole('Student'), (req, res) => {
  const rows = db.prepare('SELECT * FROM certificates WHERE student_id = ? ORDER BY issue_date DESC, uploaded_at DESC').all(req.user.id)
  res.json({ certificates: rows.map(publicCertificate) })
})

app.post('/api/student/certificates', requireAuth, requireRole('Student'), (req, res) => {
  certificateUpload.single('certificate')(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Certificate upload failed.' })
    if (req.file && !hasValidCertificateSignature(req.file)) {
      fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({ error: 'The uploaded file does not match its certificate file type.' })
    }

    const payload = req.body || {}
    const name = String(payload.name || '').trim()
    const issuer = String(payload.issuer || '').trim()
    const issueDate = String(payload.issueDate || payload.issue_date || '').trim()
    const credentialId = String(payload.credentialId || payload.credential_id || '').trim()
    const credentialUrl = String(payload.credentialUrl || payload.credential_url || '').trim()
    const description = String(payload.description || '').trim()

    if (!name || !issuer || !issueDate) {
      if (req.file) fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({ error: 'Certificate name, issuer, and issue date are required.' })
    }

    const id = randomUUID()
    const fileName = req.file ? path.basename(req.file.originalname) : ''
    const fileSize = req.file ? req.file.size : 0
    const storedName = req.file ? req.file.filename : ''

    db.prepare(`INSERT INTO certificates (id, student_id, name, issuer, issue_date, credential_id, credential_url, description, file_name, file_size, stored_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.user.id, name, issuer, issueDate, credentialId, credentialUrl, description, fileName, fileSize, storedName)

    const row = db.prepare('SELECT * FROM certificates WHERE id = ?').get(id)
    return res.status(201).json({ certificate: publicCertificate(row) })
  })
})

app.get('/api/student/certificates/:id', requireAuth, requireRole('Student'), (req, res) => {
  const row = db.prepare('SELECT * FROM certificates WHERE id = ? AND student_id = ?').get(req.params.id, req.user.id)
  if (!row) return res.status(404).json({ error: 'Certificate not found.' })
  res.json({ certificate: publicCertificate(row) })
})

app.put('/api/student/certificates/:id', requireAuth, requireRole('Student'), (req, res) => {
  const existing = db.prepare('SELECT * FROM certificates WHERE id = ? AND student_id = ?').get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ error: 'Certificate not found.' })

  certificateUpload.single('certificate')(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Certificate update failed.' })
    if (req.file && !hasValidCertificateSignature(req.file)) {
      fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({ error: 'The uploaded file does not match its certificate file type.' })
    }

    const row = existing

    const payload = req.body || {}
    const name = String(payload.name || '').trim()
    const issuer = String(payload.issuer || '').trim()
    const issueDate = String(payload.issueDate || payload.issue_date || '').trim()
    const credentialId = String(payload.credentialId || payload.credential_id || '').trim()
    const credentialUrl = String(payload.credentialUrl || payload.credential_url || '').trim()
    const description = String(payload.description || '').trim()

    if (!name || !issuer || !issueDate) {
      if (req.file) fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({ error: 'Certificate name, issuer, and issue date are required.' })
    }

    let fileName = row.file_name
    let fileSize = row.file_size
    let storedName = row.stored_name

    if (req.file) {
      if (row.stored_name) fs.rmSync(path.join(uploadDirectory, row.stored_name), { force: true })
      fileName = path.basename(req.file.originalname)
      fileSize = req.file.size
      storedName = req.file.filename
    }

    db.prepare(`UPDATE certificates
      SET name = ?, issuer = ?, issue_date = ?, credential_id = ?, credential_url = ?, description = ?, file_name = ?, file_size = ?, stored_name = ?, uploaded_at = datetime('now')
      WHERE id = ? AND student_id = ?`)
      .run(name, issuer, issueDate, credentialId, credentialUrl, description, fileName, fileSize, storedName, req.params.id, req.user.id)

    const updated = db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id)
    return res.json({ certificate: publicCertificate(updated) })
  })
})

app.delete('/api/student/certificates/:id', requireAuth, requireRole('Student'), (req, res) => {
  const row = db.prepare('SELECT * FROM certificates WHERE id = ? AND student_id = ?').get(req.params.id, req.user.id)
  if (!row) return res.status(404).json({ error: 'Certificate not found.' })
  if (row.stored_name) fs.rmSync(path.join(uploadDirectory, row.stored_name), { force: true })
  db.prepare('DELETE FROM certificates WHERE id = ? AND student_id = ?').run(req.params.id, req.user.id)
  res.json({ deleted: true, id: req.params.id })
})

app.get('/api/student/certificates/:id/file', requireAuth, requireRole('Student'), (req, res) => {
  const row = db.prepare('SELECT * FROM certificates WHERE id = ? AND student_id = ?').get(req.params.id, req.user.id)
  if (!row || !row.stored_name) return res.status(404).json({ error: 'This certificate has no uploaded file.' })

  const extension = path.extname(row.file_name || row.stored_name).toLowerCase()
  const contentType = extension === '.pdf' ? 'application/pdf' : extension === '.png' ? 'image/png' : 'image/jpeg'
  const download = req.query.download === '1' || req.query.download === 'true'
  const disposition = download ? 'attachment' : 'inline'
  res.set('Content-Type', contentType)
  res.set('Content-Disposition', `${disposition}; filename="${path.basename(row.file_name || row.stored_name).replace(/"/g, '')}"`)
  res.set('X-Content-Type-Options', 'nosniff')
  return res.sendFile(path.join(uploadDirectory, row.stored_name))
})

app.get('/api/student/applications', requireAuth, requireRole('Student'), (req, res) => {
  const rows = db.prepare(`SELECT a.*, d.company, d.role, d.salary, d.min_cgpa, d.max_backlogs, d.branches_json, d.skills_json, d.preferred_json, d.keywords_json, d.deadline, d.description
    FROM applications a JOIN drives d ON d.id = a.drive_id WHERE a.student_id = ? ORDER BY a.applied_at DESC`).all(req.user.id)
  res.json({ applications: rows.map((row) => ({
    id: row.id,
    status: row.status,
    appliedAt: row.applied_at,
    score: row.match_score,
    scoreBreakdown: parseJson(row.score_json, {}),
    drive: publicDrive(row),
  })) })
})

app.post('/api/drives/:id/apply', requireAuth, requireRole('Student'), (req, res) => {
  const drive = getDrive(req.params.id)
  if (!drive || drive.status !== 'Open' || drive.deadline < new Date().toISOString().slice(0, 10)) return res.status(404).json({ error: 'This drive is no longer accepting applications.' })
  const profile = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (profile.cgpa < drive.min_cgpa || profile.backlogs > drive.max_backlogs || !parseJson(drive.branches_json).includes(profile.branch)) return res.status(403).json({ error: 'Your profile does not meet this drive’s eligibility requirements.' })
  const scoreProfile = { cgpa: profile.cgpa, skills: parseJson(profile.skills_json), certifications: profile.certifications }
  const breakdown = scoreApplication(drive, scoreProfile)
  const id = randomUUID()
  try {
    db.prepare('INSERT INTO applications (id, drive_id, student_id, match_score, score_json, profile_snapshot_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, drive.id, profile.id, breakdown.score, JSON.stringify(breakdown), JSON.stringify({ ...publicUser(profile), skills: scoreProfile.skills }))
    return res.status(201).json({ application: { id, drive: publicDrive(drive), status: 'Under review', score: breakdown.score, scoreBreakdown: breakdown } })
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'You have already applied to this drive.' })
    return res.status(500).json({ error: 'Could not submit this application.' })
  }
})

app.get('/api/tp/drives', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const rows = db.prepare(`SELECT d.*, COUNT(a.id) AS applicant_count FROM drives d LEFT JOIN applications a ON a.drive_id = d.id
    WHERE d.owner_id = ? GROUP BY d.id ORDER BY d.created_at DESC`).all(req.user.id)
  res.json({ drives: rows.map((row) => ({ ...publicDrive(row), applicantCount: row.applicant_count })) })
})

app.post('/api/tp/drives', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const input = req.body || {}
  const errors = validateDrive(input)
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors })
  const id = randomUUID()
  db.prepare(`INSERT INTO drives (id, owner_id, company, role, salary, min_cgpa, max_backlogs, branches_json, skills_json, preferred_json, keywords_json, deadline, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.user.id, String(input.company).trim(), String(input.role).trim(), Number(input.salary), Number(input.cgpa), Number(input.backlogs),
      JSON.stringify(input.branches), JSON.stringify(input.skills), JSON.stringify(input.preferred || []), JSON.stringify(input.keywords || []), input.deadline, String(input.description).trim())
  return res.status(201).json({ drive: publicDrive(getDrive(id)) })
})

app.patch('/api/tp/drives/:id/status', requireAuth, requireRole('T&P Officer'), (req, res) => {
  if (!['Open', 'Closed'].includes(req.body?.status)) return res.status(400).json({ error: 'Choose Open or Closed.' })
  const result = db.prepare('UPDATE drives SET status = ? WHERE id = ? AND owner_id = ?').run(req.body.status, req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Drive not found.' })
  res.json({ drive: publicDrive(getDrive(req.params.id)) })
})

app.get('/api/tp/drives/:id/applicants', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const drive = requireOwnedDrive(req.params.id, req.user.id)
  if (!drive) return res.status(404).json({ error: 'Drive not found.' })
  const rows = db.prepare(`SELECT a.*, u.id AS student_user_id, u.name, u.email, u.branch, u.cgpa, u.backlogs, u.certifications, u.skills_json,
    EXISTS(SELECT 1 FROM resumes r WHERE r.student_id = u.id) AS has_resume,
    (SELECT COUNT(*) FROM certificates c WHERE c.student_id = u.id) AS certificate_count
    FROM applications a JOIN users u ON u.id = a.student_id WHERE a.drive_id = ? ORDER BY a.match_score DESC, a.applied_at ASC`).all(drive.id)
  res.json({ applicants: rows.map((row) => ({
    id: row.id, studentId: row.student_user_id, name: row.name, email: row.email, branch: row.branch, cgpa: row.cgpa, backlogs: row.backlogs,
    certifications: row.certifications, certificateCount: row.certificate_count, skills: parseJson(row.skills_json), score: row.match_score,
    scoreBreakdown: parseJson(row.score_json, {}), status: row.status, appliedAt: row.applied_at, hasResume: Boolean(row.has_resume),
  })) })
})

app.patch('/api/tp/applications/:id/status', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const status = req.body?.status
  if (!['Under review', 'Shortlisted', 'Selected', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Choose a valid application status.' })
  const result = db.prepare(`UPDATE applications SET status = ? WHERE id = ? AND drive_id IN (SELECT id FROM drives WHERE owner_id = ?)`)
    .run(status, req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Application not found.' })
  res.json({ application: db.prepare('SELECT id, status FROM applications WHERE id = ?').get(req.params.id) })
})

app.get('/api/tp/applications/:id/resume', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const row = db.prepare(`SELECT r.stored_name, r.original_name FROM resumes r
    JOIN applications a ON a.student_id = r.student_id
    JOIN drives d ON d.id = a.drive_id
    WHERE a.id = ? AND d.owner_id = ?`).get(req.params.id, req.user.id)
  if (!row) return res.status(404).json({ error: 'This applicant has not uploaded a resume.' })
  res.set('Content-Type', 'application/pdf')
  res.set('Content-Disposition', `inline; filename="${path.basename(row.original_name).replace(/"/g, '')}"`)
  res.set('X-Content-Type-Options', 'nosniff')
  return res.sendFile(path.join(uploadDirectory, row.stored_name))
})

app.get('/api/tp/applications/:id/certificates', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const application = db.prepare(`SELECT a.student_id FROM applications a
    JOIN drives d ON d.id = a.drive_id
    WHERE a.id = ? AND d.owner_id = ?`).get(req.params.id, req.user.id)
  if (!application) return res.status(404).json({ error: 'Application not found.' })
  const rows = db.prepare('SELECT * FROM certificates WHERE student_id = ? ORDER BY issue_date DESC, uploaded_at DESC').all(application.student_id)
  res.json({ studentId: application.student_id, certificateCount: rows.length, certificates: rows.map(publicCertificate) })
})

app.get('/api/tp/students', requireAuth, requireRole('T&P Officer'), (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.branch, u.cgpa, u.backlogs, u.skills_json,
      EXISTS(SELECT 1 FROM resumes r WHERE r.student_id = u.id) AS has_resume,
      (SELECT COUNT(*) FROM certificates c WHERE c.student_id = u.id) AS certificate_count
    FROM users u
    WHERE u.role = 'Student'
    ORDER BY u.name COLLATE NOCASE
  `).all()
  res.json({
    students: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      branch: row.branch,
      cgpa: row.cgpa,
      backlogs: row.backlogs,
      skills: parseJson(row.skills_json),
      hasResume: Boolean(row.has_resume),
      certificateCount: row.certificate_count,
    })),
  })
})

app.get('/api/tp/students/:id', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const student = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'Student'").get(req.params.id)
  if (!student) return res.status(404).json({ error: 'Student not found.' })
  const resume = db.prepare('SELECT original_name, size_bytes, uploaded_at FROM resumes WHERE student_id = ?').get(student.id)
  const certRows = db.prepare('SELECT * FROM certificates WHERE student_id = ? ORDER BY issue_date DESC, uploaded_at DESC').all(student.id)
  res.json({
    student: {
      ...publicUser(student),
      hasResume: Boolean(resume),
      resume: resume ? { name: resume.original_name, size: resume.size_bytes, uploadedAt: resume.uploaded_at } : null,
      certificateCount: certRows.length,
      certificates: certRows.map(publicCertificate),
    },
  })
})

app.get('/api/tp/students/:id/resume', requireAuth, requireRole('T&P Officer'), (req, res) => {
  const resume = db.prepare('SELECT original_name, stored_name FROM resumes WHERE student_id = ?').get(req.params.id)
  if (!resume) return res.status(404).json({ error: 'No resume has been uploaded by this student.' })
  const filePath = path.join(uploadDirectory, resume.stored_name)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Resume file is not available on disk.' })
  res.set('Content-Type', 'application/pdf')
  res.set('Content-Disposition', `inline; filename="${path.basename(resume.original_name).replace(/"/g, '')}"`)
  res.set('X-Content-Type-Options', 'nosniff')
  return res.sendFile(filePath)
})

function handleStudentCertificatesForTP(req, res) {
  const student = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'Student'").get(req.params.studentId || req.params.id)
  if (!student) return res.status(404).json({ error: 'Student not found.' })
  const rows = db.prepare('SELECT * FROM certificates WHERE student_id = ? ORDER BY issue_date DESC, uploaded_at DESC').all(student.id)
  res.json({
    studentId: student.id,
    studentName: student.name,
    certificateCount: rows.length,
    certificates: rows.map(publicCertificate),
  })
}

app.get('/api/tp/students/:id/certificates', requireAuth, requireRole('T&P Officer'), handleStudentCertificatesForTP)
app.get('/api/tp-cell/students/:student_id/certificates', requireAuth, requireRole('T&P Officer'), (req, res) => {
  req.params.id = req.params.student_id
  handleStudentCertificatesForTP(req, res)
})

function handleServeCertificateFileForTP(req, res) {
  const studentId = req.params.studentId || req.params.student_id
  const certificateId = req.params.certificateId || req.params.id
  let query = 'SELECT * FROM certificates WHERE id = ?'
  const params = [certificateId]
  if (studentId) {
    query += ' AND student_id = ?'
    params.push(studentId)
  }
  const row = db.prepare(query).get(...params)
  if (!row || !row.stored_name) return res.status(404).json({ error: 'Certificate file not found or not uploaded.' })

  const filePath = path.join(uploadDirectory, row.stored_name)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Certificate file is not available on disk.' })

  const extension = path.extname(row.file_name || row.stored_name).toLowerCase()
  const contentType = extension === '.pdf' ? 'application/pdf' : extension === '.png' ? 'image/png' : 'image/jpeg'
  const download = req.query.download === '1' || req.query.download === 'true'
  const disposition = download ? 'attachment' : 'inline'
  const safeName = path.basename(row.file_name || row.stored_name).replace(/"/g, '')

  res.set('Content-Type', contentType)
  res.set('Content-Disposition', `${disposition}; filename="${safeName}"`)
  res.set('X-Content-Type-Options', 'nosniff')
  return res.sendFile(filePath)
}

app.get('/api/tp/students/:studentId/certificates/:certificateId/file', requireAuth, requireRole('T&P Officer'), handleServeCertificateFileForTP)
app.get('/api/tp-cell/students/:student_id/certificates/:certificateId/file', requireAuth, requireRole('T&P Officer'), handleServeCertificateFileForTP)
app.get('/api/tp/certificates/:certificateId/file', requireAuth, requireRole('T&P Officer'), (req, res) => {
  req.params.studentId = null
  handleServeCertificateFileForTP(req, res)
})


app.get('/api/alumni/mentors', requireAuth, requireRole('Student', 'Alumni'), (_req, res) => {
  const mentors = db.prepare("SELECT id, name, company, job_title FROM users WHERE role = 'Alumni' ORDER BY name COLLATE NOCASE").all()
  res.json({ mentors })
})

app.get('/api/alumni/mentorship-requests', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT m.*, s.name AS student_name, a.name AS alumni_name FROM mentorship_requests m
    JOIN users s ON s.id = m.student_id JOIN users a ON a.id = m.alumni_id
    WHERE m.student_id = ? OR m.alumni_id = ? ORDER BY m.created_at DESC`).all(req.user.id, req.user.id)
  res.json({ requests: rows })
})

app.post('/api/alumni/mentorship-requests', requireAuth, requireRole('Student'), (req, res) => {
  const mentor = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'Alumni'").get(req.body?.alumniId)
  if (!mentor) return res.status(404).json({ error: 'Alumni account not found.' })
  const id = randomUUID()
  try {
    db.prepare('INSERT INTO mentorship_requests (id, student_id, alumni_id, message) VALUES (?, ?, ?, ?)')
      .run(id, req.user.id, mentor.id, String(req.body?.message || '').trim())
    res.status(201).json({ request: db.prepare('SELECT * FROM mentorship_requests WHERE id = ?').get(id) })
  } catch {
    res.status(409).json({ error: 'You have already requested mentorship from this alumnus.' })
  }
})

app.patch('/api/alumni/mentorship-requests/:id', requireAuth, requireRole('Alumni'), (req, res) => {
  const status = req.body?.status
  if (!['Accepted', 'Declined'].includes(status)) return res.status(400).json({ error: 'Choose Accepted or Declined.' })
  const result = db.prepare('UPDATE mentorship_requests SET status = ? WHERE id = ? AND alumni_id = ?').run(status, req.params.id, req.user.id)
  if (!result.changes) return res.status(404).json({ error: 'Mentorship request not found.' })
  res.json({ request: db.prepare('SELECT * FROM mentorship_requests WHERE id = ?').get(req.params.id) })
})

app.get('/api/alumni/interview-slots', requireAuth, (_req, res) => {
  const slots = db.prepare(`SELECT s.*, u.name AS alumni_name, u.company FROM interview_slots s JOIN users u ON u.id = s.alumni_id
    WHERE s.status = 'Open' ORDER BY s.starts_at ASC`).all()
  res.json({ slots })
})

app.post('/api/alumni/interview-slots', requireAuth, requireRole('Alumni'), (req, res) => {
  const { topic, startsAt, mode } = req.body || {}
  if (!String(topic || '').trim() || !startsAt || Number.isNaN(Date.parse(startsAt)) || Date.parse(startsAt) <= Date.now()) return res.status(400).json({ error: 'Enter a topic and a future interview time.' })
  const id = randomUUID()
  db.prepare('INSERT INTO interview_slots (id, alumni_id, topic, starts_at, mode) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, String(topic).trim(), new Date(startsAt).toISOString(), String(mode || 'Video call'))
  res.status(201).json({ slot: db.prepare('SELECT * FROM interview_slots WHERE id = ?').get(id) })
})

app.post('/api/alumni/interview-slots/:id/book', requireAuth, requireRole('Student'), (req, res) => {
  const slot = db.prepare("SELECT * FROM interview_slots WHERE id = ? AND status = 'Open'").get(req.params.id)
  if (!slot) return res.status(404).json({ error: 'This interview slot is no longer available.' })
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO interview_bookings (id, slot_id, student_id) VALUES (?, ?, ?)').run(randomUUID(), slot.id, req.user.id)
      db.prepare("UPDATE interview_slots SET status = 'Booked' WHERE id = ?").run(slot.id)
    })()
    res.status(201).json({ booked: true })
  } catch {
    res.status(409).json({ error: 'This interview slot has already been booked.' })
  }
})

app.get('/api/alumni/referrals', requireAuth, requireRole('Alumni', 'Student'), (req, res) => {
  if (req.user.role !== 'Alumni') return res.json({ referrals: [] })
  const referrals = db.prepare(`SELECT r.*, d.company, d.role, d.salary, d.deadline FROM referrals r JOIN drives d ON d.id = r.drive_id
    WHERE r.alumni_id = ? ORDER BY r.created_at DESC`).all(req.user.id)
  res.json({ referrals })
})

app.post('/api/alumni/referrals', requireAuth, requireRole('Alumni'), (req, res) => {
  const drive = db.prepare("SELECT id FROM drives WHERE id = ? AND status = 'Open'").get(req.body?.driveId)
  if (!drive) return res.status(404).json({ error: 'Open drive not found.' })
  const id = randomUUID()
  try {
    db.prepare('INSERT INTO referrals (id, alumni_id, drive_id) VALUES (?, ?, ?)').run(id, req.user.id, drive.id)
    res.status(201).json({ referral: db.prepare('SELECT * FROM referrals WHERE id = ?').get(id) })
  } catch {
    res.status(409).json({ error: 'A referral request for this drive already exists.' })
  }
})

app.get('/api/alumni/forum', requireAuth, (_req, res) => {
  const posts = db.prepare(`SELECT p.id, p.parent_id AS parentId, p.content, p.created_at AS createdAt, u.name AS author,
    (SELECT COUNT(*) FROM forum_posts reply WHERE reply.parent_id = p.id) AS replies
    FROM forum_posts p JOIN users u ON u.id = p.author_id WHERE p.parent_id IS NULL ORDER BY p.created_at DESC`).all()
  res.json({ posts })
})

app.post('/api/alumni/forum', requireAuth, (req, res) => {
  const content = String(req.body?.content || '').trim()
  if (!content || content.length > 2000) return res.status(400).json({ error: 'Post text must be between 1 and 2,000 characters.' })
  const parentId = req.body?.parentId || null
  if (parentId && !db.prepare('SELECT id FROM forum_posts WHERE id = ? AND parent_id IS NULL').get(parentId)) return res.status(404).json({ error: 'Discussion not found.' })
  const id = randomUUID()
  db.prepare('INSERT INTO forum_posts (id, author_id, parent_id, content) VALUES (?, ?, ?, ?)').run(id, req.user.id, parentId, content)
  res.status(201).json({ post: { id, parentId, author: req.user.name, content, replies: 0 } })
})

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Resume must be 2 MB or smaller.' : 'Resume upload failed.' })
  console.error(error)
  return res.status(500).json({ error: 'The server could not complete this request.' })
})

app.listen(port, host, () => console.log(`CareerCompass API listening at http://${host}:${port}`))
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'

export function seedNoticesIfEmpty() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM announcements').get()
  if (countRow?.count > 0) return

  const tpOfficer = db.prepare("SELECT id, name, role FROM users WHERE role = 'T&P Officer' LIMIT 1").get()
  const alumni = db.prepare("SELECT id, name, role FROM users WHERE role = 'Alumni' LIMIT 1").get()
  const infosysDrive = db.prepare("SELECT id FROM drives WHERE company LIKE '%infosys%' LIMIT 1").get()

  const tpAuthorId = tpOfficer?.id || 'tp-officer-demo-id'
  const tpAuthorName = tpOfficer?.name || 'Prof. Rajesh Sharma (T&P Officer)'
  const alumniAuthorId = alumni?.id || 'alumni-demo-id'
  const alumniAuthorName = alumni?.name || 'Shreya Sarode (Alumni · Software Engineer)'

  const seedData = [
    {
      id: randomUUID(),
      title: 'Infosys Campus Placement Drive 2026 — Official Registration Open',
      description: 'The Training & Placement Cell is pleased to announce the upcoming Infosys campus placement drive. All eligible students from Final Year and Third Year across CSE, IT, AIDS, AIML, and ECE departments must verify their profile details and submit applications before the deadline. Online assessments will commence next week.',
      category: 'Placement Drive',
      priority: 'Urgent',
      author_id: tpAuthorId,
      author_role: 'T&P Officer',
      author_name: tpAuthorName,
      target_audience_json: JSON.stringify({
        roles: ['Student'],
        years: ['Final Year', 'Third Year'],
        branches: ['CSE', 'IT', 'AIDS', 'AIML', 'ECE'],
      }),
      linked_drive_id: infosysDrive?.id || null,
      attachment_original_name: 'Infosys_Recruitment_Guidelines_2026.pdf',
      attachment_stored_name: '',
      attachment_size_bytes: 145200,
      external_link: 'https://careers.infosys.com',
      is_archived: 0,
      expires_at: '2026-11-15',
    },
    {
      id: randomUUID(),
      title: 'College-Wide Pre-Placement Aptitude & Technical Interview Boot Camp',
      description: 'Mandatory aptitude evaluation and mock technical interview workshop organized by the T&P Cell in collaboration with industry partners. Open to students of all academic years (1st through 4th year). Topics include DSA patterns, quantitative problem solving, and resume structuring.',
      category: 'Workshop',
      priority: 'Important',
      author_id: tpAuthorId,
      author_role: 'T&P Officer',
      author_name: tpAuthorName,
      target_audience_json: JSON.stringify({
        roles: ['Student'],
        years: ['First Year', 'Second Year', 'Third Year', 'Final Year'],
        branches: ['All branches'],
      }),
      linked_drive_id: null,
      attachment_original_name: 'Bootcamp_Schedule_and_Syllabus.pdf',
      attachment_stored_name: '',
      attachment_size_bytes: 84200,
      external_link: '',
      is_archived: 0,
      expires_at: '2026-12-01',
    },
    {
      id: randomUUID(),
      title: 'Alumni Mentorship & Off-Campus Internship Referrals (Summer 2027)',
      description: 'Hey juniors! Our cloud architecture team is opening summer internships for pre-final and sophomore engineering students. If you have solid foundations in Python, Node.js, and basic cloud concepts, connect with me through the Alumni Hub or submit your resume directly for employee referral.',
      category: 'Internship',
      priority: 'General',
      author_id: alumniAuthorId,
      author_role: 'Alumni',
      author_name: alumniAuthorName,
      target_audience_json: JSON.stringify({
        roles: ['Student'],
        years: ['Second Year', 'Third Year'],
        branches: ['CSE', 'IT', 'AIDS', 'AIML'],
      }),
      linked_drive_id: null,
      attachment_original_name: '',
      attachment_stored_name: '',
      attachment_size_bytes: 0,
      external_link: 'https://github.com',
      is_archived: 0,
      expires_at: '2026-11-30',
    },
    {
      id: randomUUID(),
      title: 'TCS Digital Pre-Placement Talk & Assessment (Concluded Cycle)',
      description: 'The pre-placement presentation and online assessment for TCS Digital recruitment has concluded. Selected candidates have been notified individually via college email.',
      category: 'Placement Drive',
      priority: 'General',
      author_id: tpAuthorId,
      author_role: 'T&P Officer',
      author_name: tpAuthorName,
      target_audience_json: JSON.stringify({
        roles: ['All'],
        years: ['Final Year'],
        branches: ['All branches'],
      }),
      linked_drive_id: null,
      attachment_original_name: '',
      attachment_stored_name: '',
      attachment_size_bytes: 0,
      external_link: '',
      is_archived: 1,
      expires_at: '2026-09-30',
    },
  ]

  const insertNotice = db.prepare(`
    INSERT INTO announcements (
      id, title, description, category, priority,
      author_id, author_role, author_name,
      target_audience_json, linked_drive_id,
      attachment_original_name, attachment_stored_name, attachment_size_bytes,
      external_link, is_archived, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `)

  for (const item of seedData) {
    insertNotice.run(
      item.id,
      item.title,
      item.description,
      item.category,
      item.priority,
      item.author_id,
      item.author_role,
      item.author_name,
      item.target_audience_json,
      item.linked_drive_id,
      item.attachment_original_name,
      item.attachment_stored_name,
      item.attachment_size_bytes,
      item.external_link,
      item.is_archived,
      item.expires_at
    )
  }

  // Also seed initial notifications for all students for active notices
  const students = db.prepare("SELECT id, academic_year, branch FROM users WHERE role = 'Student'").all()
  const insertNotification = db.prepare(`
    INSERT INTO notifications (
      id, user_id, announcement_id, linked_drive_id, title, message, type, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'announcement', 0, datetime('now'))
  `)

  for (const notice of seedData.filter((n) => n.is_archived === 0)) {
    const targetAudience = JSON.parse(notice.target_audience_json)
    const targetYears = targetAudience.years || []
    const targetBranches = targetAudience.branches || []

    for (const student of students) {
      if (targetYears.length > 0 && !targetYears.includes('All Years')) {
        if (!student.academic_year || !targetYears.includes(student.academic_year)) continue
      }
      if (targetBranches.length > 0 && !targetBranches.includes('All branches')) {
        if (!student.branch || !targetBranches.includes(student.branch)) continue
      }

      const priorityPrefix = notice.priority === 'Urgent' ? '🚨 [Urgent] ' : notice.priority === 'Important' ? '⭐ [Important] ' : ''
      insertNotification.run(
        randomUUID(),
        student.id,
        notice.id,
        notice.linked_drive_id,
        `${priorityPrefix}${notice.category}: ${notice.title}`,
        notice.title.slice(0, 80)
      )
    }
  }

  console.log('[Notice Seed] Successfully seeded initial campus announcements and notifications.')
}

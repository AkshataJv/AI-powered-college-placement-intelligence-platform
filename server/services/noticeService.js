import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { db, uploadDirectory } from '../db.js'

function parseJson(val, fallback = {}) {
  try {
    return JSON.parse(val || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

export const NOTICE_CATEGORIES = [
  'Placement Drive',
  'Internship',
  'Important Notice',
  'Event',
  'Workshop',
  'Mentorship',
  'General',
]

export const NOTICE_PRIORITIES = ['Urgent', 'Important', 'General']

export const ALUMNI_ALLOWED_CATEGORIES = [
  'Internship',
  'Event',
  'Workshop',
  'Mentorship',
  'General',
]

/**
 * Format a notice row from the database into a clean client object.
 */
export function publicNotice(row, currentUserId = null) {
  const targetAudience = parseJson(row.target_audience_json, {
    roles: ['All'],
    years: [],
    branches: [],
  })

  let isRead = false
  if (row.is_read_by_user !== undefined) {
    isRead = Boolean(row.is_read_by_user)
  } else if (currentUserId) {
    const readRow = db
      .prepare('SELECT 1 FROM announcement_reads WHERE announcement_id = ? AND user_id = ?')
      .get(row.id, currentUserId)
    isRead = Boolean(readRow)
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const isExpired = Boolean(row.expires_at && row.expires_at < todayStr)
  const isArchived = Boolean(row.is_archived) || isExpired

  let linkedDrive = null
  if (row.linked_drive_id) {
    const driveRow = db
      .prepare('SELECT id, company, role, salary, min_cgpa, max_backlogs, branches_json, eligible_years_json, deadline, status FROM drives WHERE id = ?')
      .get(row.linked_drive_id)
    if (driveRow) {
      linkedDrive = {
        id: driveRow.id,
        company: driveRow.company,
        role: driveRow.role,
        salary: driveRow.salary,
        cgpa: driveRow.min_cgpa,
        backlogs: driveRow.max_backlogs,
        branches: parseJson(driveRow.branches_json, []),
        eligibleYears: parseJson(driveRow.eligible_years_json, ['Final Year']),
        deadline: driveRow.deadline,
        status: driveRow.status,
      }
    }
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    authorId: row.author_id,
    authorRole: row.author_role,
    authorName: row.author_name,
    targetAudience,
    linkedDriveId: row.linked_drive_id || null,
    linkedDrive,
    hasAttachment: Boolean(row.attachment_stored_name),
    attachmentName: row.attachment_original_name || '',
    attachmentSize: row.attachment_size_bytes || 0,
    externalLink: row.external_link || '',
    isArchived,
    isExpired,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isRead,
    readCount: row.read_count ?? 0,
  }
}

/**
 * Check if a notice is targeted to a specific student.
 */
function isNoticeTargetedToStudent(targetAudience, student) {
  const roles = targetAudience.roles || ['All']
  if (!roles.includes('All') && !roles.includes('Student')) {
    return false
  }

  const targetYears = targetAudience.years || []
  if (targetYears.length > 0 && !targetYears.includes('All Years')) {
    const studentYear = student.academicYear || student.academic_year || ''
    if (!studentYear || !targetYears.includes(studentYear)) {
      return false
    }
  }

  const targetBranches = targetAudience.branches || []
  if (targetBranches.length > 0 && !targetBranches.includes('All branches')) {
    const studentBranch = student.branch || ''
    if (!studentBranch || !targetBranches.includes(studentBranch)) {
      return false
    }
  }

  return true
}

/**
 * Create a new announcement and dispatch audience-targeted notifications.
 */
export function createAnnouncement(author, data, file = null) {
  if (author.role === 'Student') {
    const err = new Error('Students are not permitted to publish announcements.')
    err.status = 403
    throw err
  }

  if (author.role === 'Alumni') {
    if (!ALUMNI_ALLOWED_CATEGORIES.includes(data.category)) {
      const err = new Error(
        `Alumni can publish ${ALUMNI_ALLOWED_CATEGORIES.join(', ')}. Official placement drives and college notices are reserved for the T&P Cell.`
      )
      err.status = 403
      throw err
    }
  }

  const title = String(data.title || '').trim()
  if (title.length < 3) {
    const err = new Error('Title must be at least 3 characters long.')
    err.status = 400
    throw err
  }

  const description = String(data.description || '').trim()
  if (!description) {
    const err = new Error('Announcement description is required.')
    err.status = 400
    throw err
  }

  const category = data.category
  if (!NOTICE_CATEGORIES.includes(category)) {
    const err = new Error(`Invalid category. Must be one of: ${NOTICE_CATEGORIES.join(', ')}`)
    err.status = 400
    throw err
  }

  const priority = data.priority || 'General'
  if (!NOTICE_PRIORITIES.includes(priority)) {
    const err = new Error(`Invalid priority. Must be one of: ${NOTICE_PRIORITIES.join(', ')}`)
    err.status = 400
    throw err
  }

  // Parse and normalize target audience
  let targetAudience = { roles: ['All'], years: [], branches: [] }
  if (typeof data.targetAudience === 'string') {
    targetAudience = parseJson(data.targetAudience, targetAudience)
  } else if (data.targetAudience && typeof data.targetAudience === 'object') {
    targetAudience = data.targetAudience
  } else {
    targetAudience = {
      roles: Array.isArray(data.targetRoles) ? data.targetRoles : ['All'],
      years: Array.isArray(data.targetYears) ? data.targetYears : [],
      branches: Array.isArray(data.targetBranches) ? data.targetBranches : [],
    }
  }

  // Linked drive validation
  let linkedDriveId = data.linkedDriveId || data.linked_drive_id || null
  if (linkedDriveId) {
    const driveCheck = db.prepare('SELECT id FROM drives WHERE id = ?').get(linkedDriveId)
    if (!driveCheck) {
      linkedDriveId = null
    }
  }

  let attachmentOriginalName = ''
  let attachmentStoredName = ''
  let attachmentSizeBytes = 0

  if (file) {
    attachmentOriginalName = path.basename(file.originalname)
    attachmentStoredName = file.filename
    attachmentSizeBytes = file.size
  }

  const externalLink = String(data.externalLink || data.external_link || '').trim()
  const expiresAt = data.expiresAt || data.expires_at || null
  const announcementId = randomUUID()

  db.prepare(`
    INSERT INTO announcements (
      id, title, description, category, priority,
      author_id, author_role, author_name,
      target_audience_json, linked_drive_id,
      attachment_original_name, attachment_stored_name, attachment_size_bytes,
      external_link, is_archived, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
  `).run(
    announcementId,
    title,
    description,
    category,
    priority,
    author.id,
    author.role,
    author.name,
    JSON.stringify(targetAudience),
    linkedDriveId,
    attachmentOriginalName,
    attachmentStoredName,
    attachmentSizeBytes,
    externalLink,
    expiresAt
  )

  // Dispatch notifications to matching target audience
  dispatchTargetedNotifications({
    announcementId,
    linkedDriveId,
    title,
    priority,
    category,
    targetAudience,
    authorId: author.id,
  })

  return getNoticeById(announcementId, author)
}

/**
 * Dispatch notifications to all users who match the target audience.
 */
function dispatchTargetedNotifications({
  announcementId,
  linkedDriveId,
  title,
  priority,
  category,
  targetAudience,
  authorId,
}) {
  const allUsers = db
    .prepare('SELECT id, role, branch, academic_year, passout_year FROM users WHERE id != ?')
    .all(authorId)

  const roles = targetAudience.roles || ['All']
  const years = targetAudience.years || []
  const branches = targetAudience.branches || []

  const eligibleUserIds = []

  for (const u of allUsers) {
    if (u.role === 'Student') {
      if (!roles.includes('All') && !roles.includes('Student')) continue

      // Academic year matching
      const userYear =
        u.academic_year ||
        (u.passout_year === 2026
          ? 'Final Year'
          : u.passout_year === 2027
          ? 'Third Year'
          : u.passout_year === 2028
          ? 'Second Year'
          : u.passout_year === 2029
          ? 'First Year'
          : '')

      if (years.length > 0 && !years.includes('All Years')) {
        if (!userYear || !years.includes(userYear)) continue
      }

      // Branch matching
      if (branches.length > 0 && !branches.includes('All branches')) {
        if (!u.branch || !branches.includes(u.branch)) continue
      }

      eligibleUserIds.push(u.id)
    } else if (u.role === 'Alumni') {
      if (roles.includes('All') || roles.includes('Alumni')) {
        eligibleUserIds.push(u.id)
      }
    } else if (u.role === 'T&P Officer') {
      // T&P officers always receive notifications of published announcements
      eligibleUserIds.push(u.id)
    }
  }

  if (!eligibleUserIds.length) return

  const priorityPrefix = priority === 'Urgent' ? '🚨 [Urgent] ' : priority === 'Important' ? '⭐ [Important] ' : ''
  const notificationTitle = `${priorityPrefix}${category}: ${title}`
  const messagePreview = title.length > 80 ? `${title.slice(0, 77)}...` : title

  const insertStmt = db.prepare(`
    INSERT INTO notifications (
      id, user_id, announcement_id, linked_drive_id, title, message, type, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'announcement', 0, datetime('now'))
  `)

  const insertMany = db.transaction((userIds) => {
    for (const userId of userIds) {
      insertStmt.run(
        randomUUID(),
        userId,
        announcementId,
        linkedDriveId,
        notificationTitle,
        messagePreview
      )
    }
  })

  try {
    insertMany(eligibleUserIds)
  } catch (err) {
    console.error('[Notification Dispatch Error]', err.message || err)
  }
}

/**
 * Get notice list with targeting, tab, category, priority, and search filters.
 */
export function getNotices(user, options = {}) {
  const tab = options.tab === 'archived' ? 'archived' : 'active'
  const category = options.category || 'All'
  const priority = options.priority || 'All'
  const search = String(options.search || '').trim().toLowerCase()
  const todayStr = new Date().toISOString().slice(0, 10)

  const rows = db
    .prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id) AS read_count,
        (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = ?) AS is_read_by_user
      FROM announcements a
      ORDER BY
        CASE WHEN a.priority = 'Urgent' THEN 1 WHEN a.priority = 'Important' THEN 2 ELSE 3 END ASC,
        a.created_at DESC
    `)
    .all(user.id)

  const notices = []

  for (const row of rows) {
    const isExpired = Boolean(row.expires_at && row.expires_at < todayStr)
    const isArchived = Boolean(row.is_archived) || isExpired

    if (tab === 'active' && isArchived) continue
    if (tab === 'archived' && !isArchived) continue

    if (category !== 'All' && row.category !== category) continue
    if (priority !== 'All' && row.priority !== priority) continue

    const targetAudience = parseJson(row.target_audience_json, {
      roles: ['All'],
      years: [],
      branches: [],
    })

    // Targeting check for students
    if (user.role === 'Student') {
      const isAuthor = row.author_id === user.id
      if (!isAuthor && !isNoticeTargetedToStudent(targetAudience, user)) {
        continue
      }
    } else if (user.role === 'Alumni') {
      const isAuthor = row.author_id === user.id
      const roles = targetAudience.roles || ['All']
      if (!isAuthor && !roles.includes('All') && !roles.includes('Alumni')) {
        continue
      }
    }
    // T&P Officer can see all notices

    if (search) {
      const matchText = `${row.title} ${row.description} ${row.category} ${row.author_name} ${row.priority}`.toLowerCase()
      if (!matchText.includes(search)) continue
    }

    notices.push(publicNotice(row, user.id))
  }

  return notices
}

/**
 * Get notice by ID, automatically recording read receipt for current user.
 */
export function getNoticeById(id, user) {
  const row = db
    .prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id) AS read_count,
        (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = ?) AS is_read_by_user
      FROM announcements a
      WHERE a.id = ?
    `)
    .get(user.id, id)

  if (!row) {
    const err = new Error('Announcement not found.')
    err.status = 404
    throw err
  }

  // Record read receipt automatically
  try {
    db.prepare(`
      INSERT INTO announcement_reads (id, announcement_id, user_id, read_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(announcement_id, user_id) DO NOTHING
    `).run(randomUUID(), id, user.id)
    row.is_read_by_user = 1
  } catch {}

  // Also mark any associated notifications as read
  try {
    db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE announcement_id = ? AND user_id = ?
    `).run(id, user.id)
  } catch {}

  return publicNotice(row, user.id)
}

/**
 * Explicitly toggle read/unread status for a notice.
 */
export function toggleNoticeRead(id, user, forceReadState = null) {
  const notice = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id)
  if (!notice) {
    const err = new Error('Announcement not found.')
    err.status = 404
    throw err
  }

  const existing = db
    .prepare('SELECT id FROM announcement_reads WHERE announcement_id = ? AND user_id = ?')
    .get(id, user.id)

  const shouldBeRead = forceReadState !== null ? Boolean(forceReadState) : !Boolean(existing)

  if (shouldBeRead) {
    db.prepare(`
      INSERT INTO announcement_reads (id, announcement_id, user_id, read_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(announcement_id, user_id) DO NOTHING
    `).run(randomUUID(), id, user.id)

    db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE announcement_id = ? AND user_id = ?
    `).run(id, user.id)
  } else {
    db.prepare(`
      DELETE FROM announcement_reads WHERE announcement_id = ? AND user_id = ?
    `).run(id, user.id)
  }

  return { id, isRead: shouldBeRead }
}

/**
 * Edit an announcement (T&P or original Alumni author).
 */
export function updateAnnouncement(id, user, data, file = null) {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id)
  if (!row) {
    const err = new Error('Announcement not found.')
    err.status = 404
    throw err
  }

  if (user.role !== 'T&P Officer' && row.author_id !== user.id) {
    const err = new Error('You do not have permission to edit this announcement.')
    err.status = 403
    throw err
  }

  if (user.role === 'Alumni' && data.category && !ALUMNI_ALLOWED_CATEGORIES.includes(data.category)) {
    const err = new Error(`Alumni cannot change category to ${data.category}.`)
    err.status = 403
    throw err
  }

  const title = String(data.title !== undefined ? data.title : row.title).trim()
  const description = String(data.description !== undefined ? data.description : row.description).trim()
  const category = data.category || row.category
  const priority = data.priority || row.priority
  const externalLink = data.externalLink !== undefined ? String(data.externalLink).trim() : row.external_link
  const expiresAt = data.expiresAt !== undefined ? data.expiresAt : row.expires_at

  let targetAudienceJson = row.target_audience_json
  if (data.targetAudience !== undefined) {
    targetAudienceJson =
      typeof data.targetAudience === 'string'
        ? data.targetAudience
        : JSON.stringify(data.targetAudience)
  }

  let linkedDriveId = data.linkedDriveId !== undefined ? data.linkedDriveId : row.linked_drive_id

  let attachmentOriginalName = row.attachment_original_name
  let attachmentStoredName = row.attachment_stored_name
  let attachmentSizeBytes = row.attachment_size_bytes

  if (file) {
    if (row.attachment_stored_name) {
      fs.rm(path.join(uploadDirectory, row.attachment_stored_name), { force: true }, () => {})
    }
    attachmentOriginalName = path.basename(file.originalname)
    attachmentStoredName = file.filename
    attachmentSizeBytes = file.size
  } else if (data.removeAttachment === 'true' || data.removeAttachment === true) {
    if (row.attachment_stored_name) {
      fs.rm(path.join(uploadDirectory, row.attachment_stored_name), { force: true }, () => {})
    }
    attachmentOriginalName = ''
    attachmentStoredName = ''
    attachmentSizeBytes = 0
  }

  db.prepare(`
    UPDATE announcements SET
      title = ?,
      description = ?,
      category = ?,
      priority = ?,
      target_audience_json = ?,
      linked_drive_id = ?,
      attachment_original_name = ?,
      attachment_stored_name = ?,
      attachment_size_bytes = ?,
      external_link = ?,
      expires_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title,
    description,
    category,
    priority,
    targetAudienceJson,
    linkedDriveId,
    attachmentOriginalName,
    attachmentStoredName,
    attachmentSizeBytes,
    externalLink,
    expiresAt,
    id
  )

  return getNoticeById(id, user)
}

/**
 * Archive or unarchive an announcement.
 */
export function archiveAnnouncement(id, user, isArchived = 1) {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id)
  if (!row) {
    const err = new Error('Announcement not found.')
    err.status = 404
    throw err
  }

  if (user.role !== 'T&P Officer' && row.author_id !== user.id) {
    const err = new Error('You do not have permission to archive this announcement.')
    err.status = 403
    throw err
  }

  db.prepare(`
    UPDATE announcements SET is_archived = ?, updated_at = datetime('now') WHERE id = ?
  `).run(isArchived ? 1 : 0, id)

  return { id, isArchived: Boolean(isArchived) }
}

/**
 * Get read statistics for a notice (author or T&P Officer only).
 */
export function getNoticeStats(id, user) {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id)
  if (!row) {
    const err = new Error('Announcement not found.')
    err.status = 404
    throw err
  }

  if (user.role !== 'T&P Officer' && row.author_id !== user.id) {
    const err = new Error('You do not have permission to view read statistics for this announcement.')
    err.status = 403
    throw err
  }

  const reads = db
    .prepare(`
      SELECT r.read_at, u.id, u.name, u.role, u.branch, u.academic_year, u.email
      FROM announcement_reads r
      JOIN users u ON u.id = r.user_id
      WHERE r.announcement_id = ?
      ORDER BY r.read_at DESC
    `)
    .all(id)

  const byYear = {}
  const byBranch = {}
  const byRole = {}

  for (const r of reads) {
    const year = r.academic_year || 'Unspecified'
    byYear[year] = (byYear[year] || 0) + 1

    const branch = r.branch || 'Other'
    byBranch[branch] = (byBranch[branch] || 0) + 1

    byRole[r.role] = (byRole[r.role] || 0) + 1
  }

  return {
    announcementId: id,
    title: row.title,
    totalReads: reads.length,
    byYear,
    byBranch,
    byRole,
    recentReaders: reads.slice(0, 50).map((r) => ({
      name: r.name,
      role: r.role,
      branch: r.branch,
      academicYear: r.academic_year,
      readAt: r.read_at,
    })),
  }
}

/**
 * Get recent notifications and unread count for current user.
 */
export function getUserNotifications(userId) {
  const notifications = db
    .prepare(`
      SELECT n.*, a.category, a.priority, a.is_archived, a.expires_at
      FROM notifications n
      LEFT JOIN announcements a ON a.id = n.announcement_id
      WHERE n.user_id = ?
        AND (a.is_archived IS NULL OR a.is_archived = 0)
        AND (a.expires_at IS NULL OR a.expires_at >= date('now'))
      ORDER BY n.is_read ASC, n.created_at DESC
      LIMIT 30
    `)
    .all(userId)

  const unreadCountRow = db
    .prepare(`
      SELECT COUNT(*) as count
      FROM notifications n
      LEFT JOIN announcements a ON a.id = n.announcement_id
      WHERE n.user_id = ? AND n.is_read = 0
        AND (a.is_archived IS NULL OR a.is_archived = 0)
        AND (a.expires_at IS NULL OR a.expires_at >= date('now'))
    `)
    .get(userId)

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      announcementId: n.announcement_id,
      linkedDriveId: n.linked_drive_id,
      title: n.title,
      message: n.message,
      type: n.type,
      category: n.category || 'General',
      priority: n.priority || 'General',
      isRead: Boolean(n.is_read),
      createdAt: n.created_at,
    })),
    unreadCount: unreadCountRow?.count || 0,
  }
}

/**
 * Mark a single notification as read.
 */
export function markNotificationRead(id, userId) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId)
  return { id, isRead: true }
}

/**
 * Mark all active notifications as read for current user.
 */
export function markAllNotificationsRead(userId) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId)
  return { success: true }
}

import React, { useEffect, useState, useRef } from 'react'
import { apiRequest } from './api'

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

const ACADEMIC_YEARS = ['First Year', 'Second Year', 'Third Year', 'Final Year']
const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML']

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)

  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// =============================================================
// Notification Bell & Popover Component
// =============================================================

export function NotificationBell({ user }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const popoverRef = useRef(null)

  async function fetchNotifications() {
    if (!user) return
    try {
      const res = await apiRequest('/notifications')
      if (res?.success) {
        setNotifications(res.notifications || [])
        setUnreadCount(res.unreadCount || 0)
      }
    } catch {
      // Quiet catch
    }
  }

  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 25000)
    return () => clearInterval(timer)
  }, [user])

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  async function handleMarkOneRead(id, e) {
    e.stopPropagation()
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  function handleNotificationClick(n) {
    if (!n.isRead) {
      apiRequest(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {})
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
    setIsOpen(false)

    if (n.announcementId) {
      window.location.href = `/notices?id=${n.announcementId}`
    } else if (n.linkedDriveId) {
      window.location.href = `/drives/${n.linkedDriveId}`
    }
  }

  if (!user) return null

  return (
    <div className="notif-wrapper" ref={popoverRef}>
      <button
        type="button"
        className={`notif-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications, ${unreadCount} unread`}
        title="Campus Notifications"
      >
        <svg
          className="bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown" role="region" aria-label="Notifications list">
          <div className="notif-dropdown-header">
            <div>
              <h4>Campus Alerts</h4>
              <small>{unreadCount} unread</small>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-read-btn"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notif-dropdown-body">
            {notifications.length === 0 ? (
              <div className="notif-empty-state">
                <span className="empty-bell-icon">🔔</span>
                <p>No notifications yet</p>
                <small>You will be alerted when new drives or college notices are published.</small>
              </div>
            ) : (
              <ul className="notif-list">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`notif-item ${n.isRead ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="notif-item-icon">
                      {n.priority === 'Urgent' ? '🚨' : n.priority === 'Important' ? '⭐' : '📢'}
                    </div>
                    <div className="notif-item-content">
                      <div className="notif-item-title-row">
                        <strong className="notif-item-title">{n.title}</strong>
                        {!n.isRead && <span className="unread-dot" title="Unread" />}
                      </div>
                      <p className="notif-item-message">{n.message}</p>
                      <span className="notif-item-time">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="notif-dropdown-footer">
            <a href="/notices" onClick={() => setIsOpen(false)}>
              Open Full Notice Board →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================
// Notice Board Main Component
// =============================================================

export function NoticeBoard({ user, profile, driveData = [] }) {
  const [notices, setNotices] = useState([])
  const [activeTab, setActiveTab] = useState('active') // 'active' | 'archived'
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingNotice, setEditingNotice] = useState(null)
  const [statsNotice, setStatsNotice] = useState(null)
  const [statsData, setStatsData] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Direct ID deep-link
  const urlParams = new URLSearchParams(window.location.search)
  const linkedNoticeId = urlParams.get('id')
  const [focusedNoticeId, setFocusedNoticeId] = useState(linkedNoticeId)

  const isTP = user?.role === 'T&P Officer'
  const isAlumni = user?.role === 'Alumni'
  const canPublish = isTP || isAlumni

  async function loadNotices() {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      q.set('tab', activeTab)
      if (categoryFilter !== 'All') q.set('category', categoryFilter)
      if (priorityFilter !== 'All') q.set('priority', priorityFilter)
      if (searchQuery.trim()) q.set('search', searchQuery.trim())

      const res = await apiRequest(`/notices?${q.toString()}`)
      if (res?.success) {
        setNotices(res.notices || [])
      } else {
        setNotices([])
      }
    } catch (err) {
      setError(err.message || 'Failed to load notices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotices()
  }, [activeTab, categoryFilter, priorityFilter])

  // Scroll to focused notice if deep-linked
  useEffect(() => {
    if (focusedNoticeId && notices.length > 0) {
      const el = document.getElementById(`notice-${focusedNoticeId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('highlight-pulse')
        setTimeout(() => el.classList.remove('highlight-pulse'), 3000)
      }
    }
  }, [focusedNoticeId, notices])

  async function handleToggleRead(noticeId, currentReadState) {
    try {
      const res = await apiRequest(`/notices/${noticeId}/toggle-read`, {
        method: 'POST',
        body: { isRead: !currentReadState },
      })
      if (res?.success) {
        setNotices((prev) =>
          prev.map((n) => (n.id === noticeId ? { ...n, isRead: res.isRead } : n))
        )
      }
    } catch (err) {
      alert(err.message || 'Failed to update read state.')
    }
  }

  async function handleArchiveToggle(noticeId, currentArchivedState) {
    if (!window.confirm(`Are you sure you want to ${currentArchivedState ? 'unarchive' : 'archive'} this announcement?`)) {
      return
    }
    try {
      const res = await apiRequest(`/notices/${noticeId}/archive`, {
        method: 'PATCH',
        body: { isArchived: !currentArchivedState },
      })
      if (res?.success) {
        setNotices((prev) => prev.filter((n) => n.id !== noticeId))
      }
    } catch (err) {
      alert(err.message || 'Failed to archive announcement.')
    }
  }

  async function handleOpenStats(notice) {
    setStatsNotice(notice)
    setStatsLoading(true)
    setStatsData(null)
    try {
      const res = await apiRequest(`/notices/${notice.id}/stats`)
      if (res?.success) {
        setStatsData(res.stats)
      }
    } catch (err) {
      alert(err.message || 'Failed to load statistics.')
    } finally {
      setStatsLoading(false)
    }
  }

  const urgentNotices = activeTab === 'active' ? notices.filter((n) => n.priority === 'Urgent') : []

  return (
    <main className="page-content notice-board-page">
      {/* Notice Board Hero */}
      <section className="hero-panel notice-hero">
        <div className="hero-content">
          <p className="eyebrow">
            CareerBridge AI <span>·</span> Notice Board &amp; Announcements
          </p>
          <h1>Official Placement Bulletins &amp; Campus Advisories</h1>
          <p className="hero-copy">
            Stay updated with confirmed placement drives, pre-placement talks, off-campus internship
            referrals, and technical workshops from first year through final year.
          </p>
          <div className="hero-stats notice-hero-stats">
            <span>📢 {notices.length} {activeTab === 'active' ? 'active notices' : 'archived notices'}</span>
            <span>🚨 {urgentNotices.length} urgent</span>
            <span>🏛️ Official T&amp;P &amp; Alumni Network</span>
          </div>

          {canPublish && (
            <div style={{ marginTop: '18px' }}>
              <button
                type="button"
                className="action-button primary-btn"
                onClick={() => {
                  setEditingNotice(null)
                  setShowCreateModal(true)
                }}
              >
                + Publish Announcement
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Urgent Notice Banner Callout */}
      {urgentNotices.length > 0 && activeTab === 'active' && (
        <section className="urgent-banner-spotlight" role="alert">
          <div className="urgent-badge-row">
            <span className="urgent-pill">🚨 URGENT CAMPUS ANNOUNCEMENT</span>
            <small>Requires immediate attention</small>
          </div>
          <div className="urgent-cards-carousel">
            {urgentNotices.map((un) => (
              <div key={un.id} className="urgent-spotlight-card">
                <div className="urgent-card-header">
                  <h3>{un.title}</h3>
                  <span className="urgent-meta-tag">{un.category}</span>
                </div>
                <p>{un.description.slice(0, 180)}...</p>
                <div className="urgent-card-footer">
                  <span className="urgent-author">By {un.authorName} ({un.authorRole})</span>
                  <a href={`#notice-${un.id}`} className="view-urgent-link">
                    Read full notice ↓
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Controls & Filter Bar */}
      <section className="notice-controls-section">
        {/* Tab Selection */}
        <div className="drive-type-tab-row">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active Announcements
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => setActiveTab('archived')}
          >
            Archived &amp; Concluded
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="notice-filter-toolbar">
          <div className="notice-search-box">
            <input
              type="text"
              placeholder="Search announcements, companies, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadNotices()}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setSearchQuery('')
                  loadNotices()
                }}
              >
                ✕
              </button>
            )}
            <button
              type="button"
              className="search-btn"
              onClick={loadNotices}
            >
              Search
            </button>
          </div>

          <div className="filter-dropdown-group">
            <label className="filter-select-label">
              Category:
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                {NOTICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-select-label">
              Priority:
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="All">All Priorities</option>
                {NOTICE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* Notice List */}
      <section className="notices-list-section" aria-label="Notices and announcements">
        {loading ? (
          <div className="analytics-loading-state">
            <div className="analytics-spinner" />
            <p>Loading campus announcements...</p>
          </div>
        ) : error ? (
          <div className="analytics-error-banner">
            <span>{error}</span>
            <button type="button" className="action-button" onClick={loadNotices}>
              Retry
            </button>
          </div>
        ) : notices.length === 0 ? (
          <div className="notices-empty-card">
            <span className="empty-icon">📭</span>
            <h3>No announcements found</h3>
            <p>
              {activeTab === 'archived'
                ? 'There are no archived announcements matching your filters.'
                : 'There are currently no active announcements matching your criteria. Check back soon!'}
            </p>
            {(categoryFilter !== 'All' || priorityFilter !== 'All' || searchQuery) && (
              <button
                type="button"
                className="action-button secondary-btn"
                onClick={() => {
                  setCategoryFilter('All')
                  setPriorityFilter('All')
                  setSearchQuery('')
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="notice-cards-grid">
            {notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                user={user}
                profile={profile}
                onToggleRead={handleToggleRead}
                onArchive={handleArchiveToggle}
                onEdit={(n) => {
                  setEditingNotice(n)
                  setShowCreateModal(true)
                }}
                onViewStats={handleOpenStats}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create / Edit Announcement Modal */}
      {showCreateModal && (
        <AnnouncementFormModal
          user={user}
          editingNotice={editingNotice}
          driveData={driveData}
          onClose={() => {
            setShowCreateModal(false)
            setEditingNotice(null)
          }}
          onSuccess={(savedNotice) => {
            setShowCreateModal(false)
            setEditingNotice(null)
            loadNotices()
          }}
        />
      )}

      {/* Read Statistics Modal */}
      {statsNotice && (
        <NoticeStatsModal
          notice={statsNotice}
          stats={statsData}
          loading={statsLoading}
          onClose={() => setStatsNotice(null)}
        />
      )}
    </main>
  )
}

// =============================================================
// Notice Card Component
// =============================================================

function NoticeCard({
  notice,
  user,
  profile,
  onToggleRead,
  onArchive,
  onEdit,
  onViewStats,
}) {
  const isAuthor = user?.id === notice.authorId
  const isTP = user?.role === 'T&P Officer'
  const canManage = isTP || isAuthor

  const isUrgent = notice.priority === 'Urgent'
  const isImportant = notice.priority === 'Important'

  const targetYears = notice.targetAudience?.years || []
  const targetBranches = notice.targetAudience?.branches || []

  // Check student eligibility for linked drive if present
  let driveEligibility = null
  if (notice.linkedDrive && profile) {
    const studentYear = profile.academicYear || ''
    const eligibleYears = notice.linkedDrive.eligibleYears || ['Final Year']
    const yearMatch = !eligibleYears.length || eligibleYears.includes(studentYear)
    const branchMatch =
      !notice.linkedDrive.branches.length ||
      notice.linkedDrive.branches.includes(profile.branch)
    const cgpaMatch = (profile.cgpa || 0) >= (notice.linkedDrive.cgpa || 0)
    const backlogsMatch = (profile.backlogs || 0) <= (notice.linkedDrive.backlogs || 0)

    const isEligible = yearMatch && branchMatch && cgpaMatch && backlogsMatch
    driveEligibility = {
      isEligible,
      status: !studentYear
        ? 'Eligibility Unconfirmed'
        : isEligible
        ? 'Eligible'
        : 'Not Eligible',
      yearMatch,
      branchMatch,
      cgpaMatch,
      backlogsMatch,
    }
  }

  return (
    <article
      id={`notice-${notice.id}`}
      className={`notice-card ${isUrgent ? 'urgent-border' : isImportant ? 'important-border' : ''} ${
        notice.isRead ? 'read' : 'unread'
      }`}
    >
      {/* Top Meta Bar */}
      <div className="notice-card-header">
        <div className="notice-badges-row">
          <span className={`category-badge cat-${notice.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
            {notice.category}
          </span>
          <span className={`priority-badge prio-${notice.priority.toLowerCase()}`}>
            {isUrgent ? '🚨 Urgent' : isImportant ? '⭐ Important' : 'General'}
          </span>
          <span className={`read-status-badge ${notice.isRead ? 'read' : 'unread'}`}>
            {notice.isRead ? '✓ Read' : '● New'}
          </span>
        </div>

        <div className="notice-time-info">
          <span>Posted {formatRelativeTime(notice.createdAt)}</span>
          {notice.expiresAt && (
            <span className={`expiry-tag ${notice.isExpired ? 'expired' : ''}`}>
              {notice.isExpired ? 'Concluded' : `Expires ${formatDate(notice.expiresAt)}`}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="notice-title">{notice.title}</h3>

      {/* Author Bar */}
      <div className="notice-author-bar">
        <span className="author-avatar">{notice.authorName ? notice.authorName[0] : 'U'}</span>
        <div className="author-info">
          <strong>{notice.authorName}</strong>
          <span className={`author-role-tag role-${notice.authorRole.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
            {notice.authorRole === 'T&P Officer'
              ? '🏛️ Official T&P Cell Notice'
              : notice.authorRole === 'Alumni'
              ? '🎓 Posted by Alumni'
              : notice.authorRole}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="notice-body-text">
        {notice.description.split('\n').map((paragraph, idx) => (
          <p key={idx}>{paragraph}</p>
        ))}
      </div>

      {/* Target Audience Tags */}
      <div className="notice-audience-tags">
        <div className="audience-pill">
          <small>Audience:</small>
          <span>
            {targetYears.length === 0 || targetYears.includes('All Years')
              ? 'All Academic Years (1st-4th)'
              : targetYears.join(', ')}
          </span>
        </div>
        <div className="audience-pill">
          <small>Branches:</small>
          <span>
            {targetBranches.length === 0 || targetBranches.includes('All branches')
              ? 'All Engineering Branches'
              : targetBranches.join(', ')}
          </span>
        </div>
      </div>

      {/* Linked Drive Snippet */}
      {notice.linkedDrive && (
        <div className="linked-drive-box">
          <div className="linked-drive-header">
            <div>
              <span className="linked-tag">🔗 Linked Placement Drive</span>
              <h4>
                {notice.linkedDrive.company} — {notice.linkedDrive.role}
              </h4>
            </div>
            {driveEligibility && (
              <span
                className={`eligibility-badge ${
                  driveEligibility.status === 'Eligible'
                    ? 'eligible'
                    : driveEligibility.status === 'Not Eligible'
                    ? 'ineligible'
                    : 'unconfirmed'
                }`}
              >
                {driveEligibility.status}
              </span>
            )}
          </div>
          <div className="linked-drive-details">
            <span>CTC: ₹{Number(notice.linkedDrive.salary).toFixed(1)} LPA</span>
            <span>Min CGPA: {notice.linkedDrive.cgpa}</span>
            <span>Backlogs ≤ {notice.linkedDrive.backlogs}</span>
            <span>Deadline: {formatDate(notice.linkedDrive.deadline)}</span>
          </div>
          <div className="linked-drive-actions">
            <a href={`/drives/${notice.linkedDrive.id}`} className="text-link">
              View Drive Details &amp; Application Criteria ↗
            </a>
          </div>
        </div>
      )}

      {/* Attachments & External Link */}
      {(notice.hasAttachment || notice.externalLink) && (
        <div className="notice-attachments-row">
          {notice.hasAttachment && (
            <a
              href={`/api/notices/${notice.id}/attachment`}
              download={notice.attachmentName}
              className="attachment-download-btn"
              title="Download attachment"
            >
              📎 {notice.attachmentName} ({Math.round(notice.attachmentSize / 1024)} KB)
            </a>
          )}
          {notice.externalLink && (
            <a
              href={notice.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link-btn"
            >
              ↗ Open Application / Reference Link
            </a>
          )}
        </div>
      )}

      {/* Card Actions Footer */}
      <div className="notice-card-footer">
        <button
          type="button"
          className="toggle-read-btn"
          onClick={() => onToggleRead(notice.id, notice.isRead)}
        >
          {notice.isRead ? 'Mark as Unread' : 'Mark as Read'}
        </button>

        <div className="author-actions-group">
          {canManage && (
            <>
              <button
                type="button"
                className="quiet-action-btn"
                onClick={() => onViewStats(notice)}
                title="View read statistics"
              >
                📊 Stats ({notice.readCount})
              </button>
              <button
                type="button"
                className="quiet-action-btn"
                onClick={() => onEdit(notice)}
                title="Edit announcement"
              >
                Edit ⚙️
              </button>
              <button
                type="button"
                className="quiet-action-btn"
                onClick={() => onArchive(notice.id, notice.isArchived)}
                title={notice.isArchived ? 'Restore to active' : 'Archive announcement'}
              >
                {notice.isArchived ? 'Restore 📤' : 'Archive 📦'}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

// =============================================================
// Announcement Form Modal (Create / Edit)
// =============================================================

function AnnouncementFormModal({
  user,
  editingNotice,
  driveData,
  onClose,
  onSuccess,
}) {
  const isEditing = Boolean(editingNotice)
  const isTP = user?.role === 'T&P Officer'

  // Categories allowed for this role
  const availableCategories = isTP
    ? NOTICE_CATEGORIES
    : NOTICE_CATEGORIES.filter((c) => c !== 'Placement Drive' && c !== 'Important Notice')

  const [title, setTitle] = useState(editingNotice?.title || '')
  const [description, setDescription] = useState(editingNotice?.description || '')
  const [category, setCategory] = useState(editingNotice?.category || availableCategories[0])
  const [priority, setPriority] = useState(editingNotice?.priority || 'General')
  const [externalLink, setExternalLink] = useState(editingNotice?.externalLink || '')
  const [expiresAt, setExpiresAt] = useState(editingNotice?.expiresAt || '')
  const [linkedDriveId, setLinkedDriveId] = useState(editingNotice?.linkedDriveId || '')

  // Target audience state
  const initialAudience = editingNotice?.targetAudience || {}
  const [targetYears, setTargetYears] = useState(initialAudience.years || [])
  const [targetBranches, setTargetBranches] = useState(initialAudience.branches || [])
  const [targetRoles, setTargetRoles] = useState(initialAudience.roles || ['Student'])

  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleYearToggle(yr) {
    setTargetYears((prev) =>
      prev.includes(yr) ? prev.filter((y) => y !== yr) : [...prev, yr]
    )
  }

  function handleBranchToggle(br) {
    setTargetBranches((prev) =>
      prev.includes(br) ? prev.filter((b) => b !== br) : [...prev, br]
    )
  }

  // When a drive is linked, autofill company/role information
  function handleLinkedDriveChange(e) {
    const driveId = e.target.value
    setLinkedDriveId(driveId)
    if (driveId) {
      const selectedDrive = driveData.find((d) => d.id === driveId)
      if (selectedDrive) {
        if (!title.trim()) {
          setTitle(`${selectedDrive.company} Campus Recruitment Drive 2026`)
        }
        if (selectedDrive.eligibleYears?.length) {
          setTargetYears(selectedDrive.eligibleYears)
        }
        if (selectedDrive.branches?.length) {
          setTargetBranches(selectedDrive.branches)
        }
        if (selectedDrive.deadline && !expiresAt) {
          setExpiresAt(selectedDrive.deadline)
        }
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!description.trim()) {
      setError('Description is required.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('description', description.trim())
      formData.append('category', category)
      formData.append('priority', priority)
      formData.append(
        'targetAudience',
        JSON.stringify({
          roles: targetRoles.length ? targetRoles : ['All'],
          years: targetYears,
          branches: targetBranches,
        })
      )
      if (linkedDriveId) formData.append('linkedDriveId', linkedDriveId)
      if (externalLink.trim()) formData.append('externalLink', externalLink.trim())
      if (expiresAt) formData.append('expiresAt', expiresAt)
      if (file) formData.append('attachment', file)

      let res
      if (isEditing) {
        res = await apiRequest(`/notices/${editingNotice.id}`, {
          method: 'PUT',
          body: formData,
        })
      } else {
        res = await apiRequest('/notices', {
          method: 'POST',
          body: formData,
        })
      }

      if (res?.success) {
        onSuccess(res.notice)
      } else {
        setError(res?.error || 'Failed to save announcement.')
      }
    } catch (err) {
      setError(err.message || 'Error saving announcement.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card notice-form-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow-dark">
              {isTP ? 'T&P CELL PUBLISHING' : 'ALUMNI OPPORTUNITY'}
            </p>
            <h3>{isEditing ? 'Edit Announcement' : 'Publish New Campus Announcement'}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="modal-body notice-form-body">
          {error && <div className="form-error-banner">{error}</div>}

          {/* Title */}
          <div className="form-group">
            <label>
              Announcement Title <strong>*</strong>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Infosys Campus Placement Drive 2026 - Registration Open"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Category & Priority Row */}
          <div className="form-row-2">
            <div className="form-group">
              <label>
                Category <strong>*</strong>
              </label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {!isTP && (
                <small className="field-hint">
                  Official Placement Drives and College Notices are restricted to T&amp;P Officers.
                </small>
              )}
            </div>

            <div className="form-group">
              <label>
                Priority Level <strong>*</strong>
              </label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {NOTICE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Linked Placement Drive */}
          {driveData && driveData.length > 0 && (
            <div className="form-group">
              <label>Link to Placement Drive (Optional)</label>
              <select value={linkedDriveId} onChange={handleLinkedDriveChange}>
                <option value="">-- No linked drive (General announcement) --</option>
                {driveData.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.company} — {d.role} (Deadline: {formatDate(d.deadline)})
                  </option>
                ))}
              </select>
              <small className="field-hint">
                Linking a drive will embed its criteria, eligibility checks, and application link.
              </small>
            </div>
          )}

          {/* Target Audience: Academic Years */}
          <fieldset className="year-picker">
            <legend>Target Academic Years</legend>
            <div className="year-picker-toolbar">
              <button
                type="button"
                className="tiny-link-btn"
                onClick={() => setTargetYears(['First Year', 'Second Year', 'Third Year', 'Final Year'])}
              >
                Select all years
              </button>
              <span>·</span>
              <button
                type="button"
                className="tiny-link-btn"
                onClick={() => setTargetYears(['Final Year'])}
              >
                Final year only
              </button>
              <span>·</span>
              <button
                type="button"
                className="tiny-link-btn"
                onClick={() => setTargetYears([])}
              >
                Clear (All Students)
              </button>
            </div>
            <div className="checkbox-grid">
              {ACADEMIC_YEARS.map((yr) => (
                <label key={yr} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={targetYears.includes(yr)}
                    onChange={() => handleYearToggle(yr)}
                  />
                  <span>{yr}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Target Audience: Branches */}
          <fieldset className="branch-picker">
            <legend>Target Engineering Branches</legend>
            <div className="year-picker-toolbar">
              <button
                type="button"
                className="tiny-link-btn"
                onClick={() => setTargetBranches([...BRANCHES])}
              >
                Select all branches
              </button>
              <span>·</span>
              <button
                type="button"
                className="tiny-link-btn"
                onClick={() => setTargetBranches([])}
              >
                Clear
              </button>
            </div>
            <div className="checkbox-grid">
              {BRANCHES.map((br) => (
                <label key={br} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={targetBranches.includes(br)}
                    onChange={() => handleBranchToggle(br)}
                  />
                  <span>{br}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Detailed Description */}
          <div className="form-group">
            <label>
              Announcement Details <strong>*</strong>
            </label>
            <textarea
              required
              rows={6}
              placeholder="Provide comprehensive details, eligibility instructions, event timings, room locations, or preparation advice..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* External Link & Expiry Date Row */}
          <div className="form-row-2">
            <div className="form-group">
              <label>External Registration / Document Link (Optional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Expiry / Concluding Date (Optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <small className="field-hint">Notice moves to Archive after this date.</small>
            </div>
          </div>

          {/* File Attachment Upload */}
          <div className="form-group">
            <label>Attach Official Document / Circular (Optional, max 5 MB)</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {editingNotice?.attachmentName && !file && (
              <small className="field-hint">
                Current attachment: {editingNotice.attachmentName} (leave empty to keep)
              </small>
            )}
          </div>

          {/* Form Actions */}
          <div className="modal-actions-row">
            <button
              type="button"
              className="action-button secondary-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-button primary-btn"
              disabled={submitting}
            >
              {submitting
                ? 'Publishing...'
                : isEditing
                ? 'Save Changes'
                : 'Publish Announcement 📢'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================
// Read Statistics Modal
// =============================================================

function NoticeStatsModal({ notice, stats, loading, onClose }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card notice-stats-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow-dark">READ AUDIT &amp; ANALYTICS</p>
            <h3>Read Statistics: {notice.title}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body stats-modal-body">
          {loading ? (
            <div className="analytics-loading-state">
              <div className="analytics-spinner" />
              <p>Aggregating read receipts...</p>
            </div>
          ) : !stats ? (
            <p>No statistics available.</p>
          ) : (
            <>
              {/* Stat Overview Cards */}
              <div className="stats-overview-grid">
                <div className="stat-box">
                  <span className="stat-num">{stats.totalReads}</span>
                  <span className="stat-label">Total Unique Reads</span>
                </div>
                <div className="stat-box">
                  <span className="stat-num">
                    {Object.keys(stats.byYear || {}).length}
                  </span>
                  <span className="stat-label">Academic Cohorts</span>
                </div>
                <div className="stat-box">
                  <span className="stat-num">
                    {Object.keys(stats.byBranch || {}).length}
                  </span>
                  <span className="stat-label">Branches Engaged</span>
                </div>
              </div>

              {/* Breakdown by Academic Year */}
              <div className="stats-breakdown-section">
                <h4>Reads by Academic Year</h4>
                <div className="breakdown-pills">
                  {Object.entries(stats.byYear || {}).map(([yr, count]) => (
                    <div key={yr} className="breakdown-pill">
                      <strong>{yr || 'Unspecified'}</strong>
                      <span>{count} reads</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown by Branch */}
              <div className="stats-breakdown-section">
                <h4>Reads by Engineering Branch</h4>
                <div className="breakdown-pills">
                  {Object.entries(stats.byBranch || {}).map(([br, count]) => (
                    <div key={br} className="breakdown-pill">
                      <strong>{br}</strong>
                      <span>{count} reads</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Readers List */}
              <div className="stats-readers-table-section">
                <h4>Recent Readers Log</h4>
                {stats.recentReaders?.length === 0 ? (
                  <p className="empty-readers-note">No students have viewed this notice yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Role</th>
                          <th>Academic Year</th>
                          <th>Branch</th>
                          <th>Read At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentReaders.map((r, i) => (
                          <tr key={i}>
                            <td><strong>{r.name}</strong></td>
                            <td>{r.role}</td>
                            <td>{r.academicYear || '—'}</td>
                            <td>{r.branch || '—'}</td>
                            <td>{formatDate(r.readAt)} {new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

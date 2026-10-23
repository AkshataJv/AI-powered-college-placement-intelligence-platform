import { useEffect, useRef, useState } from 'react'
import { apiRequest } from './api'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function formatChatTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday = now.toDateString() === date.toDateString()
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return timeStr
  const isThisYear = now.getFullYear() === date.getFullYear()
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: isThisYear ? undefined : 'numeric' })
  return `${dateStr}, ${timeStr}`
}

// -------------------------------------------------------------
// Connect Modal for sending connection requests
// -------------------------------------------------------------
export function ConnectModal({ alumni, onClose, onSuccess }) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!alumni) return null

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await apiRequest('/connections/requests', {
        method: 'POST',
        body: { alumniId: alumni.id, message: message.trim() },
      })
      onSuccess(response.request)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="chat-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label={`Connect with ${alumni.name}`}
        aria-modal="true"
        className="chat-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="chat-modal-header">
          <div>
            <p className="eyebrow-dark">NEW CONNECTION</p>
            <h2>Connect with {alumni.name}</h2>
            <p className="chat-modal-subtitle">{alumni.job_title ? `${alumni.job_title} at ` : ''}{alumni.company || 'Alumni Mentor'}</p>
          </div>
          <button aria-label="Close dialog" className="quiet-button" onClick={onClose} type="button">✕</button>
        </header>

        <form className="connect-form" onSubmit={handleSubmit}>
          <label htmlFor="connect-note">
            <span>Include a personal note (optional)</span>
            <textarea
              id="connect-note"
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi, I'm interested in your experience at your company and would love to connect for placement guidance…"
              rows={4}
              value={message}
            />
          </label>
          <div className="connect-note-count">{message.length}/1000</div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="chat-modal-actions">
            <button className="quiet-button" disabled={submitting} onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? 'Sending request…' : 'Send Connection Request'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

// -------------------------------------------------------------
// Connection Requests Section (Alumni & Student views)
// -------------------------------------------------------------
export function ConnectionRequestsView({ user, connectionRequests, onUpdateRequestStatus, onOpenChat }) {
  const isAlumni = user.role === 'Alumni'
  const [filter, setFilter] = useState('All')
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')

  const filteredRequests = connectionRequests.filter((req) => {
    if (filter === 'All') return true
    return req.status === filter
  })

  async function handleStatusChange(id, status) {
    setError('')
    setUpdatingId(id)
    try {
      await onUpdateRequestStatus(id, status)
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="alumni-content connection-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow-dark">{isAlumni ? 'STUDENT OUTREACH' : 'MY NETWORK'}</p>
          <h2>{isAlumni ? 'Connection Requests' : 'My Connection Requests'}</h2>
        </div>
        <div className="filter-pill-group">
          {['All', 'Pending', 'Accepted', 'Rejected'].map((status) => {
            const count = connectionRequests.filter((r) => status === 'All' || r.status === status).length
            return (
              <button
                className={`filter-pill ${filter === status ? 'active' : ''}`}
                key={status}
                onClick={() => setFilter(status)}
                type="button"
              >
                {status} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {isAlumni ? (
        <div className="connection-cards-grid">
          {filteredRequests.map((req) => {
            const student = req.student || {}
            return (
              <article className="connection-card" key={req.id}>
                <div className="connection-card-header">
                  <div className="connection-avatar">{getInitials(student.name)}</div>
                  <div className="connection-user-info">
                    <h3>{student.name}</h3>
                    <p className="connection-user-meta">{student.branch} <span>·</span> {student.email}</p>
                  </div>
                  <span className={`connection-status-badge status-${req.status.toLowerCase()}`}>
                    {req.status}
                  </span>
                </div>

                <div className="student-profile-metrics">
                  <div className="metric-pill"><strong>CGPA:</strong> {student.cgpa ? Number(student.cgpa).toFixed(2) : '—'}</div>
                  <div className="metric-pill"><strong>Backlogs:</strong> {student.backlogs ?? 0}</div>
                  <div className="metric-pill"><strong>Certifications:</strong> {student.certifications ?? 0}</div>
                </div>

                {Array.isArray(student.skills) && student.skills.length > 0 && (
                  <div className="student-skills-chips">
                    {student.skills.map((skill) => (
                      <span className="skill-chip" key={skill}>{skill}</span>
                    ))}
                  </div>
                )}

                {req.message && (
                  <div className="connection-note">
                    <p className="note-label">Message from student:</p>
                    <p className="note-body">“{req.message}”</p>
                  </div>
                )}

                <div className="connection-card-footer">
                  <span className="connection-date">Received {formatChatTime(req.createdAt)}</span>
                  <div className="connection-actions">
                    {req.status === 'Pending' && (
                      <>
                        <button
                          className="reject-action-btn"
                          disabled={updatingId === req.id}
                          onClick={() => handleStatusChange(req.id, 'Rejected')}
                          type="button"
                        >
                          ✕ Reject
                        </button>
                        <button
                          className="accept-action-btn"
                          disabled={updatingId === req.id}
                          onClick={() => handleStatusChange(req.id, 'Accepted')}
                          type="button"
                        >
                          ✓ Accept
                        </button>
                      </>
                    )}
                    {req.status === 'Accepted' && (
                      <button
                        className="message-action-btn"
                        onClick={() => onOpenChat(req.conversationId)}
                        type="button"
                      >
                        💬 Message
                      </button>
                    )}
                    {req.status === 'Rejected' && (
                      <span className="rejected-note">Request declined</span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="connection-cards-grid">
          {filteredRequests.map((req) => {
            const alumni = req.alumni || {}
            return (
              <article className="connection-card" key={req.id}>
                <div className="connection-card-header">
                  <div className="connection-avatar">{getInitials(alumni.name)}</div>
                  <div className="connection-user-info">
                    <h3>{alumni.name}</h3>
                    <p className="connection-user-meta">
                      {alumni.jobTitle ? `${alumni.jobTitle} · ` : ''}{alumni.company || 'Alumni'}
                    </p>
                  </div>
                  <span className={`connection-status-badge status-${req.status.toLowerCase()}`}>
                    {req.status}
                  </span>
                </div>

                {req.message && (
                  <div className="connection-note">
                    <p className="note-label">Your note:</p>
                    <p className="note-body">“{req.message}”</p>
                  </div>
                )}

                <div className="connection-card-footer">
                  <span className="connection-date">Sent {formatChatTime(req.createdAt)}</span>
                  <div className="connection-actions">
                    {req.status === 'Accepted' && (
                      <button
                        className="message-action-btn"
                        onClick={() => onOpenChat(req.conversationId)}
                        type="button"
                      >
                        💬 Message
                      </button>
                    )}
                    {req.status === 'Pending' && (
                      <span className="pending-note">Waiting for alumni response</span>
                    )}
                    {req.status === 'Rejected' && (
                      <span className="rejected-note">Request not accepted</span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {filteredRequests.length === 0 && (
        <div className="empty-state">
          <h2>No connection requests found</h2>
          <p>{isAlumni ? 'Student connection requests will appear here when they reach out.' : 'You have no connection requests matching this status.'}</p>
        </div>
      )}
    </section>
  )
}

// -------------------------------------------------------------
// Private One-to-One Chat Interface
// -------------------------------------------------------------
export function PrivateChatView({ user, conversations, activeConversationId, onSelectConversation, onRefreshConversations }) {
  const [messages, setMessages] = useState([])
  const [activePartner, setActivePartner] = useState(null)
  const [inputText, setInputText] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const messagesEndRef = useRef(null)

  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!activeConversationId && conversations && conversations.length > 0) {
      const timer = setTimeout(() => {
        onSelectConversation(conversations[0].id)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [activeConversationId, conversations, onSelectConversation])

  // Scroll messages to bottom smoothly
  function scrollToBottom(behavior = 'smooth') {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' })
    }
  }

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      return
    }

    let isCancelled = false

    async function fetchMessages() {
      setLoadingMessages(true)
      setChatError('')
      try {
        const response = await apiRequest(`/chat/conversations/${activeConversationId}/messages`)
        if (isCancelled) return
        setMessages(response.messages || [])
        setActivePartner(response.conversation?.partner || null)
        setTimeout(() => scrollToBottom('auto'), 50)
      } catch (err) {
        if (!isCancelled) setChatError(err.message)
      } finally {
        if (!isCancelled) setLoadingMessages(false)
      }
    }

    const timer = setTimeout(() => {
      fetchMessages()
    }, 0)

    // Real-time polling every 3.5 seconds for new messages
    const interval = setInterval(async () => {
      try {
        const response = await apiRequest(`/chat/conversations/${activeConversationId}/messages`)
        if (isCancelled) return
        setMessages((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(response.messages)) {
            setTimeout(() => scrollToBottom('smooth'), 50)
            return response.messages || []
          }
          return prev
        })
        if (onRefreshConversations) onRefreshConversations()
      } catch {
        // quiet poll fail
      }
    }, 3500)

    return () => {
      isCancelled = true
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [activeConversationId, onRefreshConversations])

  async function handleSendMessage(event) {
    event.preventDefault()
    const content = inputText.trim()
    if (!content || sending || !activeConversationId) return

    setSending(true)
    setChatError('')
    setInputText('')

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`
    const optimisticMessage = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: user.id,
      content,
      readAt: null,
      createdAt: new Date().toISOString(),
      isSelf: true,
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setTimeout(() => scrollToBottom('smooth'), 20)

    try {
      const response = await apiRequest(`/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        body: { content },
      })
      // Replace optimistic message with server message
      setMessages((prev) => prev.map((m) => (m.id === tempId ? response.message : m)))
      if (onRefreshConversations) onRefreshConversations()
    } catch (err) {
      setChatError(err.message)
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage(event)
    }
  }

  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter.trim()) return true
    const term = searchFilter.toLowerCase()
    return c.partner?.name?.toLowerCase().includes(term) || c.partner?.detail?.toLowerCase().includes(term)
  })

  return (
    <section className="alumni-content private-chat-workspace">
      <div className="chat-layout-wrapper">
        {/* Left pane: Conversation list */}
        <aside className={`chat-sidebar ${activeConversationId ? 'has-active' : ''}`}>
          <div className="chat-sidebar-header">
            <h3>Direct Messages</h3>
            <span className="chat-total-badge">{conversations.length}</span>
          </div>

          <div className="chat-search-wrap">
            <input
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter conversations…"
              type="text"
              value={searchFilter}
            />
          </div>

          <div className="conversation-items-list" role="list">
            {filteredConversations.map((conv) => {
              const partner = conv.partner || {}
              const isSelected = conv.id === activeConversationId
              return (
                <button
                  aria-selected={isSelected}
                  className={`conversation-item-btn ${isSelected ? 'selected' : ''}`}
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  type="button"
                >
                  <div className="conv-avatar">{getInitials(partner.name)}</div>
                  <div className="conv-content">
                    <div className="conv-top-row">
                      <strong className="conv-name">{partner.name}</strong>
                      {conv.lastMessage && (
                        <span className="conv-time">{formatChatTime(conv.lastMessage.createdAt)}</span>
                      )}
                    </div>
                    <div className="conv-sub-row">
                      <span className="conv-role-tag">{partner.role}</span>
                      <p className="conv-snippet">
                        {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="conv-unread-bubble">{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {filteredConversations.length === 0 && (
              <div className="conversations-empty">
                <p>No conversations found.</p>
                <small>Connect with alumni or students to start private messaging.</small>
              </div>
            )}
          </div>
        </aside>

        {/* Right pane: Active chat window */}
        <div className={`chat-thread-pane ${!activeConversationId ? 'empty-active' : ''}`}>
          {activeConversationId ? (
            <>
              {/* Chat Thread Header */}
              <header className="chat-thread-header">
                <button
                  className="mobile-back-btn quiet-button"
                  onClick={() => onSelectConversation(null)}
                  type="button"
                >
                  ← Conversations
                </button>
                <div className="chat-header-avatar">{getInitials(activePartner?.name)}</div>
                <div className="chat-header-info">
                  <h4>{activePartner?.name || activeConversation?.partner?.name || 'Conversation'}</h4>
                  <p className="chat-header-meta">
                    <span className="online-indicator" /> Connected {activePartner?.role || activeConversation?.partner?.role} {activePartner?.detail ? `· ${activePartner.detail}` : ''}
                  </p>
                </div>
              </header>

              {chatError && <div className="chat-error-bar" role="alert">{chatError}</div>}

              {/* Messages Scroll Area */}
              <div className="chat-messages-container">
                {loadingMessages && messages.length === 0 ? (
                  <div className="chat-loading-spinner">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="chat-first-message-prompt">
                    <div className="prompt-icon">💬</div>
                    <h4>Private chat with {activePartner?.name || 'this member'}</h4>
                    <p>All messages are end-to-end authorized and private between the two of you.</p>
                    <small>Say hello and ask about placements, mentorship, or interview preparation!</small>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.isSelf || msg.senderId === user.id
                    return (
                      <div className={`chat-message-row ${isSelf ? 'msg-outgoing' : 'msg-incoming'}`} key={msg.id}>
                        {!isSelf && (
                          <div className="msg-sender-avatar">{getInitials(activePartner?.name)}</div>
                        )}
                        <div className="msg-bubble-wrap">
                          <div className={`msg-bubble ${isSelf ? 'bubble-outgoing' : 'bubble-incoming'}`}>
                            <p className="msg-text">{msg.content}</p>
                          </div>
                          <span className="msg-timestamp">
                            {formatChatTime(msg.createdAt)}
                            {isSelf && (msg.readAt ? ' · Read' : ' · Sent')}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Compose Box */}
              <form className="chat-compose-box" onSubmit={handleSendMessage}>
                <textarea
                  disabled={sending}
                  maxLength={2000}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Press Enter to send, Shift+Enter for new line)"
                  rows={2}
                  value={inputText}
                />
                <button
                  aria-label="Send message"
                  className="primary-button send-btn"
                  disabled={!inputText.trim() || sending}
                  type="submit"
                >
                  {sending ? '…' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <div className="no-chat-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose an accepted connection from the sidebar to view chat history and send messages.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// Alumni Profile Top Card (Displayed at the top of Alumni Hub)
// -------------------------------------------------------------
export function AlumniProfileTopCard({ user, onOpenEdit, isSidebar = false }) {
  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() : 'AL'
  const skills = Array.isArray(user?.skills) ? user.skills : []

  return (
    <section aria-label="Alumni Profile Summary" className={`alumni-top-profile-card${isSidebar ? ' is-sidebar' : ''}`}>
      <div className="alumni-profile-header-row">
        <div className="alumni-profile-identity">
          <div className="alumni-profile-avatar">{initials}</div>
          <div className="alumni-profile-titles">
            <div className="alumni-profile-badge-row">
              <span className="alumni-status-tag">Verified Alumnus</span>
              {user?.branch && <span className="alumni-meta-tag">{user.branch}</span>}
              {Boolean(user?.passoutYear) && <span className="alumni-meta-tag">Class of {user.passoutYear}</span>}
            </div>
            <h2 className="alumni-profile-name">{user?.name || 'Alumni Mentor'}</h2>
            <p className="alumni-profile-headline">
              <strong>{user?.jobTitle || 'Alumni Mentor'}</strong>
              {user?.company ? <span> at <strong className="highlight-company">{user.company}</strong></span> : null}
            </p>
          </div>
        </div>
        <div className="alumni-profile-actions">
          <button className="primary-button edit-profile-btn" onClick={onOpenEdit} type="button">
            ✏️ Edit Profile
          </button>
        </div>
      </div>

      <div className="alumni-profile-details-grid">
        <div className="alumni-detail-block">
          <span className="detail-label">Experience</span>
          <p className="detail-value">
            {user?.experience ? user.experience : <em className="muted-placeholder">Add your experience and domain expertise…</em>}
          </p>
        </div>

        <div className="alumni-detail-block">
          <span className="detail-label">About &amp; Mentorship Focus</span>
          <p className="detail-value">
            {user?.bio ? user.bio : <em className="muted-placeholder">Share your career journey or how you can guide juniors…</em>}
          </p>
        </div>

        {skills.length > 0 && (
          <div className="alumni-detail-block full-width">
            <span className="detail-label">Industry &amp; Technical Skills</span>
            <div className="skill-list alumni-skills">
              {skills.map((skill) => (
                <span className="skill-tag" key={skill}>{skill}</span>
              ))}
            </div>
          </div>
        )}

        {user?.linkedinUrl && (
          <div className="alumni-detail-block full-width">
            <span className="detail-label">LinkedIn / Profile Link</span>
            <a className="text-link alumni-linkedin-link" href={user.linkedinUrl} rel="noreferrer" target="_blank">
              🔗 {user.linkedinUrl} ↗
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// Alumni Edit Profile Modal Dialog
// -------------------------------------------------------------
export function AlumniEditProfileModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user?.name || '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '')
  const [company, setCompany] = useState(user?.company || '')
  const [experience, setExperience] = useState(user?.experience || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [branch, setBranch] = useState(user?.branch || 'CSE')
  const [passoutYear, setPassoutYear] = useState(user?.passoutYear ? String(user.passoutYear) : '')
  const [skillsText, setSkillsText] = useState(() => (Array.isArray(user?.skills) ? user.skills.join(', ') : ''))
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedinUrl || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean)
      await onSave({
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        experience: experience.trim(),
        bio: bio.trim(),
        branch,
        passoutYear: passoutYear ? Number(passoutYear) : 0,
        skills,
        linkedinUrl: linkedinUrl.trim(),
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="connect-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="Edit Alumni Profile"
        aria-modal="true"
        className="chat-modal-dialog alumni-edit-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="chat-modal-header">
          <div>
            <p className="eyebrow-dark">ALUMNI PROFILE</p>
            <h2>Edit Your Profile &amp; Experience</h2>
            <p className="chat-modal-subtitle">Keep your professional credentials updated so campus students can seek relevant guidance.</p>
          </div>
          <button aria-label="Close dialog" className="quiet-button" onClick={onClose} type="button">✕</button>
        </header>

        {error && <div className="chat-error-bar" role="alert">{error}</div>}

        <form className="alumni-edit-form" onSubmit={handleSubmit}>
          <div className="form-grid-two">
            <label htmlFor="alumni-edit-name">
              <span>Full Name *</span>
              <input
                id="alumni-edit-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kundan Suryavanshi"
                required
                type="text"
                value={name}
              />
            </label>

            <label htmlFor="alumni-edit-branch">
              <span>Graduation Branch</span>
              <select id="alumni-edit-branch" onChange={(e) => setBranch(e.target.value)} value={branch}>
                {['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid-two">
            <label htmlFor="alumni-edit-title">
              <span>Current Role / Job Title</span>
              <input
                id="alumni-edit-title"
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Project Manager / Staff Engineer"
                type="text"
                value={jobTitle}
              />
            </label>

            <label htmlFor="alumni-edit-company">
              <span>Current Company / Organization</span>
              <input
                id="alumni-edit-company"
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Ayunext / Microsoft / Google"
                type="text"
                value={company}
              />
            </label>
          </div>

          <div className="form-grid-two">
            <label htmlFor="alumni-edit-exp">
              <span>Experience &amp; Focus Area</span>
              <input
                id="alumni-edit-exp"
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g. 5+ Years in Product Management & Cloud"
                type="text"
                value={experience}
              />
            </label>

            <label htmlFor="alumni-edit-passout">
              <span>Graduation / Passout Year</span>
              <input
                id="alumni-edit-passout"
                max="2099"
                min="1980"
                onChange={(e) => setPassoutYear(e.target.value)}
                placeholder="e.g. 2020"
                type="number"
                value={passoutYear}
              />
            </label>
          </div>

          <label htmlFor="alumni-edit-skills">
            <span>Industry Skills &amp; Technologies (separated by commas)</span>
            <input
              id="alumni-edit-skills"
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="e.g. Project Management, Agile, React, Node.js, System Architecture"
              type="text"
              value={skillsText}
            />
          </label>

          <label htmlFor="alumni-edit-bio">
            <span>Bio &amp; Mentorship Summary</span>
            <textarea
              id="alumni-edit-bio"
              maxLength={1500}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell students about your journey, what projects you work on, and how you're open to assisting them with placement guidance…"
              rows={3}
              value={bio}
            />
          </label>

          <label htmlFor="alumni-edit-linkedin">
            <span>LinkedIn / Portfolio URL</span>
            <input
              id="alumni-edit-linkedin"
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              type="url"
              value={linkedinUrl}
            />
          </label>

            <div className="modal-actions-row">
            <button className="quiet-button" disabled={submitting} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? 'Saving changes…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

// -------------------------------------------------------------
// Alumni Edit Profile Tab Panel (For internal tab editing)
// -------------------------------------------------------------
export function AlumniEditProfileTabPanel({ user, onCancel, onSave }) {
  const [name, setName] = useState(user?.name || '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '')
  const [company, setCompany] = useState(user?.company || '')
  const [experience, setExperience] = useState(user?.experience || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [branch, setBranch] = useState(user?.branch || 'CSE')
  const [passoutYear, setPassoutYear] = useState(user?.passoutYear ? String(user.passoutYear) : '')
  const [skillsText, setSkillsText] = useState(() => (Array.isArray(user?.skills) ? user.skills.join(', ') : ''))
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedinUrl || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    setError('')
    setSubmitting(true)
    setSavedSuccess(false)
    try {
      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean)
      await onSave({
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        experience: experience.trim(),
        bio: bio.trim(),
        branch,
        passoutYear: passoutYear ? Number(passoutYear) : 0,
        skills,
        linkedinUrl: linkedinUrl.trim(),
      })
      setSavedSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article aria-label="Edit Alumni Profile" className="alumni-edit-tab-card">
      <div className="alumni-edit-tab-intro">
        <div>
          <span className="eyebrow-dark">PROFILE SETTINGS</span>
          <h3>Edit Your Profile &amp; Experience</h3>
          <p className="alumni-edit-tab-desc">Keep your professional credentials updated so campus students can seek relevant guidance.</p>
        </div>
      </div>

      {error && <div className="chat-error-bar" role="alert">{error}</div>}
      {savedSuccess && (
        <div className="profile-save-success-bar" role="status">
          ✓ Profile updated successfully!
        </div>
      )}

      <form className="alumni-edit-form alumni-edit-tab-form" onSubmit={handleSubmit}>
        <div className="form-grid-two">
          <label htmlFor="alumni-edit-name">
            <span>Full Name *</span>
            <input
              id="alumni-edit-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kundan Suryavanshi"
              required
              type="text"
              value={name}
            />
          </label>

          <label htmlFor="alumni-edit-branch">
            <span>Graduation Branch</span>
            <select id="alumni-edit-branch" onChange={(e) => setBranch(e.target.value)} value={branch}>
              {['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS', 'AIML'].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid-two">
          <label htmlFor="alumni-edit-title">
            <span>Current Role / Job Title</span>
            <input
              id="alumni-edit-title"
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Project Manager / Staff Engineer"
              type="text"
              value={jobTitle}
            />
          </label>

          <label htmlFor="alumni-edit-company">
            <span>Current Company / Organization</span>
            <input
              id="alumni-edit-company"
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Ayunext / Microsoft / Google"
              type="text"
              value={company}
            />
          </label>
        </div>

        <div className="form-grid-two">
          <label htmlFor="alumni-edit-exp">
            <span>Experience &amp; Focus Area</span>
            <input
              id="alumni-edit-exp"
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 5+ Years in Product Management & Cloud"
              type="text"
              value={experience}
            />
          </label>

          <label htmlFor="alumni-edit-passout">
            <span>Graduation / Passout Year</span>
            <input
              id="alumni-edit-passout"
              max="2099"
              min="1980"
              onChange={(e) => setPassoutYear(e.target.value)}
              placeholder="e.g. 2020"
              type="number"
              value={passoutYear}
            />
          </label>
        </div>

        <label htmlFor="alumni-edit-skills">
          <span>Industry Skills &amp; Technologies (separated by commas)</span>
          <input
            id="alumni-edit-skills"
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="e.g. Project Management, Agile, React, Node.js, System Architecture"
            type="text"
            value={skillsText}
          />
        </label>

        <label htmlFor="alumni-edit-bio">
          <span>Bio &amp; Mentorship Summary</span>
          <textarea
            id="alumni-edit-bio"
            maxLength={1500}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell students about your journey, what projects you work on, and how you're open to assisting them with placement guidance…"
            rows={4}
            value={bio}
          />
        </label>

        <label htmlFor="alumni-edit-linkedin">
          <span>LinkedIn / Portfolio URL</span>
          <input
            id="alumni-edit-linkedin"
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/username"
            type="url"
            value={linkedinUrl}
          />
        </label>

        <div className="alumni-edit-tab-actions">
          {onCancel && (
            <button className="quiet-button" disabled={submitting} onClick={onCancel} type="button">
              ← Back to Profile View
            </button>
          )}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Saving changes…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </article>
  )
}



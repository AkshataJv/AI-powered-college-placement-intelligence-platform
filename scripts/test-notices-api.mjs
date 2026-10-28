import assert from 'node:assert'

const API = 'http://127.0.0.1:3001/api'

async function request(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(options.body)
  }
  const res = await fetch(`${API}${path}`, { ...options, headers })
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await res.json() : await res.text()
  return { status: res.status, ok: res.ok, data }
}

async function main() {
  console.log('=== STARTING NOTICE BOARD & NOTIFICATION INTEGRATION TESTS ===')

  // Setup: Register or sign in test accounts for Student, Alumni, and T&P Officer
  const ts = Date.now()
  const studentYear2Email = `student.yr2.${ts}@test.edu`
  const studentYear4Email = `student.yr4.${ts}@test.edu`
  const alumniEmail = `alumni.${ts}@test.edu`
  const tpEmail = `tp.${ts}@test.edu`

  console.log('1. Registering test users (2nd Yr Student, 4th Yr Student, Alumni, T&P Officer)...')

  // Register 2nd year student
  const regS2 = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Sneha Patil',
      email: studentYear2Email,
      password: 'Password123',
      role: 'Student',
      branch: 'CSE',
      cgpa: 8.5,
      backlogs: 0,
      academicYear: 'Second Year',
    },
  })
  assert.strictEqual(regS2.status, 201, `Student Yr 2 registration failed: ${JSON.stringify(regS2.data)}`)
  const s2Token = regS2.data.token
  const s2User = regS2.data.user

  // Register 4th year student
  const regS4 = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Aditya Deshmukh',
      email: studentYear4Email,
      password: 'Password123',
      role: 'Student',
      branch: 'CSE',
      cgpa: 9.0,
      backlogs: 0,
      academicYear: 'Final Year',
    },
  })
  assert.strictEqual(regS4.status, 201, `Student Yr 4 registration failed: ${JSON.stringify(regS4.data)}`)
  const s4Token = regS4.data.token
  const s4User = regS4.data.user

  // Register Alumni
  const regAlumni = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Vikram Joshi',
      email: alumniEmail,
      password: 'Password123',
      role: 'Alumni',
      company: 'TechCorp Cloud',
      jobTitle: 'Senior SRE',
    },
  })
  assert.strictEqual(regAlumni.status, 201, 'Alumni registration failed')
  const alumniToken = regAlumni.data.token

  // Register T&P Officer
  const regTp = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Prof. S. R. Kulkarni',
      email: tpEmail,
      password: 'Password123',
      role: 'T&P Officer',
    },
  })
  assert.strictEqual(regTp.status, 201, 'T&P Officer registration failed')
  const tpToken = regTp.data.token

  console.log('✓ All 4 test users registered and authenticated.')

  // 2. Test publishing permissions
  console.log('2. Testing publishing permissions...')

  // 2a: Student attempts to publish a notice -> MUST fail with 403
  const studentPublish = await request('/notices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${s2Token}` },
    body: {
      title: 'Student Attempted Notice',
      description: 'This should not be allowed.',
      category: 'General',
      priority: 'General',
    },
  })
  assert.strictEqual(studentPublish.status, 403, 'Student publishing should be blocked with 403')
  console.log('✓ Student cannot publish notices (403 Forbidden).')

  // 2b: Alumni attempts to publish an official 'Placement Drive' -> MUST fail with 403
  const alumniFakeDrive = await request('/notices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alumniToken}` },
    body: {
      title: 'Official Drive Fake Notice',
      description: 'Alumni cannot publish official placement drives.',
      category: 'Placement Drive',
      priority: 'Urgent',
    },
  })
  assert.strictEqual(alumniFakeDrive.status, 403, 'Alumni publishing official placement drive should be blocked with 403')
  console.log('✓ Alumni cannot publish official placement drives (403 Forbidden).')

  // 2c: Alumni publishes valid Internship announcement -> MUST succeed
  const alumniNotice = await request('/notices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alumniToken}` },
    body: {
      title: 'DevOps & Cloud Summer Internship 2027',
      description: 'Looking for enthusiastic 2nd and 3rd year students for cloud engineering internships.',
      category: 'Internship',
      priority: 'Important',
      targetAudience: {
        roles: ['Student'],
        years: ['Second Year', 'Third Year'],
        branches: ['CSE', 'IT'],
      },
      externalLink: 'https://example.com/apply',
    },
  })
  assert.strictEqual(alumniNotice.status, 201, 'Alumni internship announcement should succeed with 201')
  assert.strictEqual(alumniNotice.data.notice.authorRole, 'Alumni', 'Author role must be Alumni')
  assert.strictEqual(alumniNotice.data.notice.category, 'Internship')
  const alumniNoticeId = alumniNotice.data.notice.id
  console.log('✓ Alumni published internship announcement with authorRole=Alumni.')

  // 2d: T&P Officer publishes an Urgent official placement drive notice targeted ONLY to Final Year
  const tpFinalYearNotice = await request('/notices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tpToken}` },
    body: {
      title: 'Microsoft Campus Drive 2026 - Final Year Only',
      description: 'Mandatory online assessment for 4th year students. Deadline tonight.',
      category: 'Placement Drive',
      priority: 'Urgent',
      targetAudience: {
        roles: ['Student'],
        years: ['Final Year'],
        branches: ['CSE', 'IT'],
      },
    },
  })
  assert.strictEqual(tpFinalYearNotice.status, 201, 'T&P announcement should succeed with 201')
  const tpNoticeId = tpFinalYearNotice.data.notice.id
  console.log('✓ T&P Officer published urgent official placement drive notice.')

  // 3. Test audience targeting and visibility
  console.log('3. Testing audience targeting and visibility...')

  // 3a: 2nd-year student retrieves active notices -> Should see Alumni notice, but NOT the Final-Year-only notice
  const s2Notices = await request('/notices?tab=active', {
    headers: { Authorization: `Bearer ${s2Token}` },
  })
  assert.strictEqual(s2Notices.status, 200)
  const s2Ids = s2Notices.data.notices.map((n) => n.id)
  assert.ok(s2Ids.includes(alumniNoticeId), '2nd year student should see Alumni notice targeted to 2nd & 3rd year')
  assert.ok(!s2Ids.includes(tpNoticeId), '2nd year student MUST NOT see notice targeted only to Final Year')
  console.log('✓ 2nd-year student does not receive notice targeted only to 4th year.')

  // 3b: 4th-year student retrieves active notices -> Should see the Final-Year-only notice
  const s4Notices = await request('/notices?tab=active', {
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  assert.strictEqual(s4Notices.status, 200)
  const s4Ids = s4Notices.data.notices.map((n) => n.id)
  assert.ok(s4Ids.includes(tpNoticeId), '4th year student MUST see notice targeted to Final Year')
  console.log('✓ 4th-year student sees the Final-Year notice.')

  // 4. Test Notification Bell System
  console.log('4. Testing notification bell and unread counts...')

  // 4a: Check notifications for 2nd-year student
  const s2Notifications = await request('/notifications', {
    headers: { Authorization: `Bearer ${s2Token}` },
  })
  assert.strictEqual(s2Notifications.status, 200)
  const s2NotifAnnounceIds = s2Notifications.data.notifications.map((n) => n.announcementId)
  assert.ok(s2NotifAnnounceIds.includes(alumniNoticeId), '2nd year student got notification for alumni internship')
  assert.ok(!s2NotifAnnounceIds.includes(tpNoticeId), '2nd year student MUST NOT have notification for 4th year drive')
  console.log('✓ 2nd-year student only received notification for notices matching their target audience.')

  // 4b: Check notifications for 4th-year student
  const s4Notifications = await request('/notifications', {
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  assert.strictEqual(s4Notifications.status, 200)
  const s4NotifAnnounceIds = s4Notifications.data.notifications.map((n) => n.announcementId)
  assert.ok(s4NotifAnnounceIds.includes(tpNoticeId), '4th year student received notification for final year drive')
  const s4Notif = s4Notifications.data.notifications.find((n) => n.announcementId === tpNoticeId)
  assert.ok(s4Notif, 'Found notification object')
  assert.strictEqual(s4Notif.isRead, false, 'Notification initially unread')
  console.log(`✓ 4th-year student has unread notification count: ${s4Notifications.data.unreadCount}`)

  // 4c: Mark single notification as read
  const markOneRead = await request(`/notifications/${s4Notif.id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  assert.strictEqual(markOneRead.status, 200)

  // 4d: Mark all notifications as read
  const markAllRead = await request('/notifications/mark-all-read', {
    method: 'POST',
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  assert.strictEqual(markAllRead.status, 200)
  const s4AfterMarkAll = await request('/notifications', {
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  assert.strictEqual(s4AfterMarkAll.data.unreadCount, 0, 'Unread count should be 0 after mark-all-read')
  console.log('✓ Mark all notifications as read succeeded (unreadCount = 0).')

  // 5. Test Read Receipts and Stats
  console.log('5. Testing read receipts and read statistics...')

  // 5a: Student views notice detail
  const viewDetail = await request(`/notices/${tpNoticeId}`, {
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  assert.strictEqual(viewDetail.status, 200)
  assert.strictEqual(viewDetail.data.notice.isRead, true, 'Notice is marked as read after viewing')

  // 5b: Toggle notice read status
  const toggleUnread = await request(`/notices/${tpNoticeId}/toggle-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s4Token}` },
    body: { isRead: false },
  })
  assert.strictEqual(toggleUnread.status, 200)
  assert.strictEqual(toggleUnread.data.isRead, false)

  const toggleReadAgain = await request(`/notices/${tpNoticeId}/toggle-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s4Token}` },
    body: { isRead: true },
  })
  assert.strictEqual(toggleReadAgain.status, 200)
  assert.strictEqual(toggleReadAgain.data.isRead, true)

  // 5c: T&P checks read stats
  const statsRes = await request(`/notices/${tpNoticeId}/stats`, {
    headers: { Authorization: `Bearer ${tpToken}` },
  })
  assert.strictEqual(statsRes.status, 200)
  assert.ok(statsRes.data.stats.totalReads >= 1, 'Total reads should be >= 1')
  console.log(`✓ Read statistics verified (Total reads: ${statsRes.data.stats.totalReads}).`)

  // 6. Test Archive Functionality
  console.log('6. Testing archiving...')

  const archiveRes = await request(`/notices/${tpNoticeId}/archive`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tpToken}` },
    body: { isArchived: true },
  })
  assert.strictEqual(archiveRes.status, 200)
  assert.strictEqual(archiveRes.data.isArchived, true)

  // Verify it appears in archived tab and disappears from active tab
  const s4ActiveAfterArchive = await request('/notices?tab=active', {
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  const s4ArchivedAfterArchive = await request('/notices?tab=archived', {
    headers: { Authorization: `Bearer ${s4Token}` },
  })
  assert.ok(!s4ActiveAfterArchive.data.notices.some((n) => n.id === tpNoticeId), 'Archived notice must not appear in active tab')
  assert.ok(s4ArchivedAfterArchive.data.notices.some((n) => n.id === tpNoticeId), 'Archived notice must appear in archived tab')
  console.log('✓ Archiving notice moves it to Archived tab correctly.')

  console.log('=== ALL NOTICE BOARD & NOTIFICATION TESTS PASSED SUCCESSFULLY! 🎉 ===')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})

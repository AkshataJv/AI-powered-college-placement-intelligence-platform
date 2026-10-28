import assert from 'node:assert/strict'

const BASE_URL = 'http://127.0.0.1:3001/api'

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok, data }
}

async function runTests() {
  console.log('--- STARTING PLACEMENT DRIVE ELIGIBILITY TESTS ---')

  // 1. Authenticate / Register as T&P Officer
  const tpEmail = `tp.test.${Date.now()}@careerbridge.edu`
  const tpReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Prof. Placement Head',
      email: tpEmail,
      password: 'Password123!',
      role: 'T&P Officer',
    }),
  })
  assert.equal(tpReg.status, 201, 'T&P Officer registration should succeed')
  const tpToken = tpReg.data.token
  const tpAuthHeaders = { Authorization: `Bearer ${tpToken}` }
  console.log('✓ 1. T&P Officer registered and authenticated successfully')

  // 2. T&P creates a drive with specific eligible academic years
  const createDriveRes = await request('/tp/drives', {
    method: 'POST',
    headers: tpAuthHeaders,
    body: JSON.stringify({
      company: 'Acme Robotics',
      role: 'Firmware Engineer',
      salary: 14.5,
      cgpa: 7.5,
      backlogs: 0,
      branches: ['CSE', 'ECE'],
      eligibleYears: ['Third Year', 'Final Year'],
      skills: ['C++', 'Embedded Systems'],
      preferred: ['RTOS'],
      keywords: ['microcontrollers'],
      deadline: '2027-12-31',
      description: 'Join our autonomous systems group.',
    }),
  })
  assert.equal(createDriveRes.status, 201, 'T&P should be able to create drive')
  const createdDrive = createDriveRes.data.drive
  assert.ok(createdDrive.id, 'Drive has id')
  assert.deepEqual(createdDrive.eligibleYears, ['Third Year', 'Final Year'], 'Drive should save eligible years')
  console.log('✓ 2. T&P created drive with eligible academic years ["Third Year", "Final Year"]')

  // 3. T&P edits the drive eligibility to include "Second Year" as well
  const editDriveRes = await request(`/tp/drives/${createdDrive.id}`, {
    method: 'PUT',
    headers: tpAuthHeaders,
    body: JSON.stringify({
      company: 'Acme Robotics',
      role: 'Firmware & Systems Engineer',
      salary: 15.0,
      cgpa: 7.0,
      backlogs: 0,
      branches: ['CSE', 'ECE', 'IT'],
      eligibleYears: ['Second Year', 'Third Year', 'Final Year'],
      skills: ['C++', 'Embedded Systems', 'Python'],
      preferred: ['RTOS', 'Linux'],
      keywords: ['microcontrollers', 'robotics'],
      deadline: '2027-12-31',
      description: 'Updated description for autonomous systems.',
      status: 'Open',
    }),
  })
  assert.equal(editDriveRes.status, 200, 'T&P should be able to edit drive')
  const updatedDrive = editDriveRes.data.drive
  assert.equal(updatedDrive.role, 'Firmware & Systems Engineer')
  assert.equal(updatedDrive.salary, 15.0)
  assert.deepEqual(updatedDrive.eligibleYears, ['Second Year', 'Third Year', 'Final Year'])
  console.log('✓ 3. T&P successfully edited drive eligibility and criteria')

  // 4. Test Student Registration / Profiles
  // 4a: Student in "First Year" (ineligible for this drive since drive is 2nd, 3rd, Final)
  const firstYearEmail = `student.firstyear.${Date.now()}@campus.edu`
  const firstYearReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Aditya First',
      email: firstYearEmail,
      password: 'password123',
      role: 'Student',
      branch: 'CSE',
      cgpa: 9.0,
      backlogs: 0,
      certifications: 1,
      skills: ['C++', 'Python'],
      academicYear: 'First Year',
    }),
  })
  assert.equal(firstYearReg.status, 201)
  const firstYearToken = firstYearReg.data.token
  const firstYearAuth = { Authorization: `Bearer ${firstYearToken}` }

  // First year student attempts to apply: MUST BE BLOCKED
  const firstYearApplyRes = await request(`/drives/${createdDrive.id}/apply`, {
    method: 'POST',
    headers: firstYearAuth,
  })
  assert.equal(firstYearApplyRes.status, 403, 'First Year student must be rejected for drive requiring 2nd/3rd/Final year')
  assert.match(firstYearApplyRes.data.error, /academic year.*not eligible/i)
  console.log('✓ 4a. First Year student is blocked from applying (403 forbidden with academic year message)')

  // 4b: Student with MISSING academic year: MUST BE BLOCKED (Eligibility Unconfirmed)
  const missingYearEmail = `student.missing.${Date.now()}@campus.edu`
  const missingYearReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sneha Unconfirmed',
      email: missingYearEmail,
      password: 'password123',
      role: 'Student',
      branch: 'CSE',
      cgpa: 8.5,
      backlogs: 0,
      certifications: 0,
      skills: ['C++'],
      academicYear: '', // missing
    }),
  })
  assert.equal(missingYearReg.status, 201)
  const missingYearAuth = { Authorization: `Bearer ${missingYearReg.data.token}` }

  const missingYearApply = await request(`/drives/${createdDrive.id}/apply`, {
    method: 'POST',
    headers: missingYearAuth,
  })
  assert.equal(missingYearApply.status, 403, 'Student with missing academic year must be blocked')
  assert.match(missingYearApply.data.error, /academic year is missing/i)
  console.log('✓ 4b. Student with missing academic year is blocked from applying (403 forbidden)')

  // 4c: Student in "Third Year" with matching branch, CGPA, backlogs: MUST SUCCEED
  const thirdYearEmail = `student.thirdyear.${Date.now()}@campus.edu`
  const thirdYearReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Kavita Third',
      email: thirdYearEmail,
      password: 'password123',
      role: 'Student',
      branch: 'CSE',
      cgpa: 8.5,
      backlogs: 0,
      certifications: 2,
      skills: ['C++', 'Embedded Systems', 'Python'],
      academicYear: 'Third Year',
    }),
  })
  assert.equal(thirdYearReg.status, 201)
  const thirdYearAuth = { Authorization: `Bearer ${thirdYearReg.data.token}` }

  const thirdYearApply = await request(`/drives/${createdDrive.id}/apply`, {
    method: 'POST',
    headers: thirdYearAuth,
  })
  assert.equal(thirdYearApply.status, 201, 'Eligible Third Year student application must succeed')
  assert.equal(thirdYearApply.data.application.status, 'Under review')
  console.log('✓ 4c. Eligible Third Year student applied successfully (201 created)')

  // 4d: Unauthorized user (Student) attempts to edit drive: MUST BE 403
  const unauthorizedEdit = await request(`/tp/drives/${createdDrive.id}`, {
    method: 'PUT',
    headers: thirdYearAuth,
    body: JSON.stringify({
      company: 'Hacked',
      role: 'Hacked',
      salary: 99,
      cgpa: 0,
      backlogs: 99,
      branches: ['CSE'],
      eligibleYears: ['First Year'],
      skills: ['None'],
      deadline: '2027-12-31',
      description: 'Hacked',
    }),
  })
  assert.equal(unauthorizedEdit.status, 403, 'Student must not be allowed to edit drives')
  console.log('✓ 5. Unauthorized student edit was blocked (403 forbidden)')

  // 4e: Student can update profile academic year
  const updateProfileRes = await request('/student/profile', {
    method: 'PUT',
    headers: missingYearAuth,
    body: JSON.stringify({
      name: 'Sneha Confirmed',
      branch: 'CSE',
      academicYear: 'Final Year',
      cgpa: 8.5,
      backlogs: 0,
      certifications: 1,
      skills: ['C++', 'Python'],
    }),
  })
  assert.equal(updateProfileRes.status, 200)
  assert.equal(updateProfileRes.data.profile.academicYear, 'Final Year')
  console.log('✓ 6. Student updated academic year in profile successfully')

  // Now that Sneha has set her academic year to "Final Year", she can apply:
  const snehaApply = await request(`/drives/${createdDrive.id}/apply`, {
    method: 'POST',
    headers: missingYearAuth,
  })
  assert.equal(snehaApply.status, 201, 'Student can apply once academic year is confirmed and eligible')
  console.log('✓ 7. Previously unconfirmed student can apply once eligible academic year is set')

  console.log('\nALL BACKEND DRIVE ELIGIBILITY TESTS PASSED SUCCESSFULLY! 🎉')
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})

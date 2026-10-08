const tokenKey = 'careerCompassToken'
const userKey = 'careerCompassUser'

export function saveSession({ token, user }) {
  sessionStorage.setItem(tokenKey, token)
  sessionStorage.setItem(userKey, JSON.stringify(user))
}

export function getSession() {
  try {
    return {
      token: sessionStorage.getItem(tokenKey),
      user: JSON.parse(sessionStorage.getItem(userKey) || 'null'),
    }
  } catch {
    return { token: null, user: null }
  }
}

export function clearSession() {
  sessionStorage.removeItem(tokenKey)
  sessionStorage.removeItem(userKey)
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = sessionStorage.getItem(tokenKey)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let body = options.body
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  const response = await fetch(`/api${path}`, { ...options, headers, body })
  const contentType = response.headers.get('content-type') || ''
  const result = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new Error(result?.error || `Request failed (${response.status}).`)
  return result
}

export async function protectedFileUrl(path) {
  const token = sessionStorage.getItem(tokenKey)
  const response = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.error || `File request failed (${response.status}).`)
  }
  return URL.createObjectURL(await response.blob())
}

export async function downloadProtectedFile(path, defaultFileName = 'certificate-file') {
  const token = sessionStorage.getItem(tokenKey)
  const response = await fetch(`/api${path}${path.includes('?') ? '&' : '?'}download=1`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.error || `File download failed (${response.status}).`)
  }
  let fileName = defaultFileName
  const disposition = response.headers.get('content-disposition')
  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/i)
    if (match && match[1]) fileName = match[1].trim()
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
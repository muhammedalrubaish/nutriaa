// Stateless signed session cookie:
//   nutrition_session = base64url("<userId>|<issuedAt base36 ms>|<HMAC-SHA256 base64url, truncated>")
import crypto from 'node:crypto'

export const COOKIE_NAME = 'nutrition_session'
export const MAX_AGE_SEC = 7 * 24 * 60 * 60

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not configured (min 16 chars)')
  return s
}

function mac(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 32)
}

export function signSession(userId, now = Date.now()) {
  const payload = `${userId}|${now.toString(36)}`
  return Buffer.from(`${payload}|${mac(payload)}`).toString('base64url')
}

/** Returns the user id, or null when the token is missing, tampered or expired. */
export function verifySession(token, now = Date.now()) {
  if (!token || typeof token !== 'string') return null
  let raw
  try {
    raw = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const parts = raw.split('|')
  if (parts.length !== 3) return null
  const [userId, issued36, sig] = parts
  const expected = mac(`${userId}|${issued36}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  const issued = parseInt(issued36, 36)
  if (!Number.isFinite(issued) || issued > now + 60_000 || now - issued > MAX_AGE_SEC * 1000) return null
  return userId || null
}

export function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim())
    } catch {
      out[k] = part.slice(i + 1).trim()
    }
  }
  return out
}

function attrs(maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; ${attrs(MAX_AGE_SEC)}`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; ${attrs(0)}`
}

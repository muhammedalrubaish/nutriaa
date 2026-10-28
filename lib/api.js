// Server-side helpers for API routes: method dispatch, session lookup and role checks.
import crypto from 'node:crypto'
import { query } from './db'
import { COOKIE_NAME, parseCookies, verifySession } from './session'
import { can } from './roles'

export const ERR = {
  AUTH: 'يجب تسجيل الدخول',
  FORBIDDEN: 'لا تملك صلاحية الوصول',
  SERVER: 'حدث خطأ في الخادم',
}

export function newId(prefix) {
  return prefix + crypto.randomBytes(8).toString('hex')
}

export async function getSessionUser(req) {
  const token = parseCookies(req.headers?.cookie || '')[COOKIE_NAME]
  const userId = verifySession(token)
  if (!userId) return null
  const rows = await query('select id, username, name, role, created_at from users where id = $1', [userId])
  return rows[0] || null
}

/**
 * Builds an API handler from a per-method spec:
 *   route({ GET: { perm, handle }, POST: { auth: false, handle } })
 * auth defaults to true; perm (optional) is checked against the user's role.
 */
export function route(spec) {
  return async function handler(req, res) {
    const entry = spec[req.method]
    if (!entry) {
      res.setHeader('Allow', Object.keys(spec).join(', '))
      return res.status(405).json({ error: 'Method not allowed' })
    }
    try {
      let user = null
      if (entry.auth !== false) {
        user = await getSessionUser(req)
        if (!user) return res.status(401).json({ error: entry.authError || ERR.AUTH })
        if (entry.perm && !can(user.role, entry.perm)) return res.status(403).json({ error: ERR.FORBIDDEN })
      }
      return await entry.handle(req, res, user)
    } catch (e) {
      console.error(`[api] ${req.method} ${req.url}`, e)
      return res.status(500).json({ error: ERR.SERVER })
    }
  }
}

export function str(v, max = 500) {
  return typeof v === 'string' ? v.trim().slice(0, max) : v == null ? '' : String(v).trim().slice(0, max)
}

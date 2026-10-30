import { COOKIE_NAME, signSession } from '@/lib/session'

process.env.SESSION_SECRET = 'test-secret-that-is-long-enough'

export const USERS = {
  u_sys: { id: 'u_sys', username: 'admin', name: 'عبدالله', role: 'sysadmin', created_at: '2026-01-01T00:00:00Z' },
  u_mgr: { id: 'u_mgr', username: 'admin1', name: 'خليل', role: 'manager', created_at: '2026-01-01T00:00:00Z' },
  u_mgr2: { id: 'u_mgr2', username: 'mgr2', name: 'مدير آخر', role: 'manager', created_at: '2026-01-01T00:00:00Z' },
  u_sup: { id: 'u_sup', username: 'sup', name: 'مشرف', role: 'supervisor', created_at: '2026-01-01T00:00:00Z' },
  u_dist: { id: 'u_dist', username: 'dist', name: 'موزعة', role: 'distributor', created_at: '2026-01-01T00:00:00Z' },
  u_spec: { id: 'u_spec', username: 'spec', name: 'أخصائية', role: 'specialist', created_at: '2026-01-01T00:00:00Z' },
}

export function mockReq({ method = 'GET', query = {}, body, user } = {}) {
  const headers = user ? { cookie: `${COOKIE_NAME}=${signSession(user)}` } : {}
  return { method, query, body, headers, url: '/test' }
}

export function mockRes() {
  const res = { statusCode: 200, body: undefined, headers: {} }
  res.status = (c) => ((res.statusCode = c), res)
  res.json = (b) => ((res.body = b), res)
  res.setHeader = (k, v) => ((res.headers[k.toLowerCase()] = v), res)
  return res
}

/** Answers the session lookup; everything else goes to `handler(sql, params)`. */
export function sqlRouter(handler) {
  return async (sql, params = []) => {
    if (/from users where id = \$1/.test(sql) && /created_at/.test(sql) && !/password_hash/.test(sql)) {
      const u = USERS[params[0]]
      return u ? [u] : []
    }
    return (await handler(sql, params)) ?? []
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { USERS, mockReq, mockRes, sqlRouter } from './helpers'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
const { query } = await import('@/lib/db')
const { signSession, verifySession, parseCookies, COOKIE_NAME } = await import('@/lib/session')
const { can, homeFor, PERMS } = await import('@/lib/roles')
const login = (await import('@/pages/api/login')).default
const me = (await import('@/pages/api/me')).default
const stats = (await import('@/pages/api/stats')).default
const users = (await import('@/pages/api/users')).default

beforeEach(() => query.mockReset())

describe('roles', () => {
  it('grants the system admin and managers everything, supervisors operations only', () => {
    for (const p of Object.values(PERMS)) {
      expect(can('sysadmin', p)).toBe(true)
      expect(can('manager', p)).toBe(true)
    }
    expect(can('supervisor', PERMS.MANAGE_USERS)).toBe(false)
    for (const p of ['CREATE_ORDERS', 'VIEW_REPORTS', 'EXPORT_REPORTS', 'DELETE_ORDERS', 'EDIT_MENU', 'SEND_NOTES'])
      expect(can('supervisor', PERMS[p])).toBe(true)
    expect(can('distributor', PERMS.CREATE_ORDERS)).toBe(true)
    expect(can('distributor', PERMS.VIEW_REPORTS)).toBe(false)
    expect(can('specialist', PERMS.EXPORT_REPORTS)).toBe(true)
    expect(can('specialist', PERMS.DELETE_ORDERS)).toBe(false)
    expect(can('specialist', PERMS.SEND_NOTES)).toBe(false)
    expect(can('unknown', PERMS.CREATE_ORDERS)).toBe(false)
  })
  it('sends each role to its home page', () => {
    expect(homeFor('sysadmin')).toBe('/')
    expect(homeFor('supervisor')).toBe('/')
    expect(homeFor('specialist')).toBe('/')
    expect(homeFor('distributor')).toBe('/orders')
    expect(homeFor('nobody')).toBe('/login')
  })
})

describe('session cookie', () => {
  it('round-trips and rejects tampering or expiry', () => {
    const t = signSession('u_sup', 1_000_000)
    expect(verifySession(t, 1_000_000 + 1000)).toBe('u_sup')
    const forged = Buffer.from(Buffer.from(t, 'base64url').toString().replace('u_sup', 'u_xyz')).toString('base64url')
    expect(verifySession(forged, 1_000_000)).toBeNull()
    expect(verifySession(t, 1_000_000 + 8 * 24 * 3600 * 1000)).toBeNull()
    expect(verifySession('garbage')).toBeNull()
  })
})

describe('POST /api/login', () => {
  it('sets an httpOnly session cookie on valid credentials and hides the hash', async () => {
    const hash = await bcrypt.hash('correct-pass', 4)
    query.mockImplementation(async () => [{ ...USERS.u_sup, password_hash: hash }])
    const res = mockRes()
    await login(mockReq({ method: 'POST', body: { username: 'sup', password: 'correct-pass' } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.user.id).toBe('u_sup')
    expect(res.body.user.password_hash).toBeUndefined()
    const cookie = res.headers['set-cookie']
    expect(cookie).toMatch(/HttpOnly/)
    expect(verifySession(parseCookies(cookie)[COOKIE_NAME])).toBe('u_sup')
  })
  it('rejects a wrong password with 401', async () => {
    const hash = await bcrypt.hash('correct-pass', 4)
    query.mockImplementation(async () => [{ ...USERS.u_sup, password_hash: hash }])
    const res = mockRes()
    await login(mockReq({ method: 'POST', body: { username: 'sup', password: 'nope' } }), res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('بيانات الدخول غير صحيحة')
  })
  it('requires both fields', async () => {
    const res = mockRes()
    await login(mockReq({ method: 'POST', body: { username: '' } }), res)
    expect(res.statusCode).toBe(400)
  })
  it('rejects other methods with 405', async () => {
    const res = mockRes()
    await login(mockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
  })
})

describe('server-side permission checks', () => {
  it('returns 401 without a session', async () => {
    query.mockImplementation(sqlRouter(() => []))
    const res = mockRes()
    await me(mockReq(), res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('غير مسجل الدخول')
  })
  it('blocks a distributor from stats and users (403)', async () => {
    query.mockImplementation(sqlRouter(() => []))
    for (const h of [stats, users]) {
      const res = mockRes()
      await h(mockReq({ user: 'u_dist' }), res)
      expect(res.statusCode).toBe(403)
      expect(res.body.error).toBe('لا تملك صلاحية الوصول')
    }
  })
  it('prevents deleting your own account', async () => {
    query.mockImplementation(sqlRouter((sql, p) => (/select id, role from users/.test(sql) ? [USERS[p[0]]] : [])))
    const res = mockRes()
    await users(mockReq({ method: 'DELETE', user: 'u_sys', body: { id: 'u_sys' } }), res)
    expect(res.statusCode).toBe(400)
  })
  it('blocks a supervisor from managing users', async () => {
    query.mockImplementation(sqlRouter(() => []))
    const res = mockRes()
    await users(mockReq({ user: 'u_sup' }), res)
    expect(res.statusCode).toBe(403)
  })
})

describe('role hierarchy on /api/users', () => {
  const writes = () => query.mock.calls.filter(([sql]) => /^\s*(insert|update|delete)/i.test(sql))
  const db = () =>
    sqlRouter((sql, p) => {
      if (/select id, role from users/.test(sql)) return USERS[p[0]] ? [USERS[p[0]]] : []
      if (/select 1 from users where username/.test(sql)) return []
      if (/insert into users/.test(sql)) return [{ id: p[0], username: p[2], name: p[1], role: p[3] }]
      return []
    })
  const call = async (method, user, body) => {
    query.mockReset()
    query.mockImplementation(db())
    const res = mockRes()
    await users(mockReq({ method, user, body }), res)
    return res.statusCode
  }
  const NEW = { name: 'x', username: 'newuser', password: 'secret1' }

  it('lets nobody create a system admin, and only the system admin create managers', async () => {
    expect(await call('POST', 'u_sys', { ...NEW, role: 'sysadmin' })).toBe(403)
    expect(await call('POST', 'u_sys', { ...NEW, role: 'manager' })).toBe(201)
    expect(await call('POST', 'u_mgr', { ...NEW, role: 'manager' })).toBe(403)
    expect(writes()).toHaveLength(0)
    expect(await call('POST', 'u_mgr', { ...NEW, role: 'supervisor' })).toBe(201)
  })

  it('stops managers from touching the system admin or other managers', async () => {
    expect(await call('PUT', 'u_mgr', { id: 'u_sys', name: 'x', role: 'sysadmin' })).toBe(403)
    expect(await call('PUT', 'u_mgr', { id: 'u_mgr2', name: 'x', role: 'manager', password: 'hacked1' })).toBe(403)
    expect(await call('DELETE', 'u_mgr', { id: 'u_sys' })).toBe(403)
    expect(await call('DELETE', 'u_mgr', { id: 'u_mgr2' })).toBe(403)
    expect(writes()).toHaveLength(0)
  })

  it('lets a manager manage lower accounts but not promote them to manager', async () => {
    expect(await call('PUT', 'u_mgr', { id: 'u_dist', name: 'x', role: 'supervisor' })).toBe(200)
    expect(await call('PUT', 'u_mgr', { id: 'u_dist', name: 'x', role: 'manager' })).toBe(403)
    expect(await call('DELETE', 'u_mgr', { id: 'u_sup' })).toBe(200)
  })

  it('lets the system admin manage managers', async () => {
    expect(await call('PUT', 'u_sys', { id: 'u_mgr', name: 'x', role: 'supervisor' })).toBe(200)
    expect(await call('DELETE', 'u_sys', { id: 'u_mgr' })).toBe(200)
  })

  it('allows editing your own name and password but never your role', async () => {
    expect(await call('PUT', 'u_mgr', { id: 'u_mgr', name: 'خليل', role: 'manager', password: 'newpass1' })).toBe(200)
    expect(await call('PUT', 'u_mgr', { id: 'u_mgr', name: 'خليل', role: 'sysadmin' })).toBe(400)
    expect(await call('PUT', 'u_sys', { id: 'u_sys', name: 'عبدالله', role: 'manager' })).toBe(400)
  })
})

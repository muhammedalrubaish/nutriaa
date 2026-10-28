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
  it('grants supervisor everything and limits the others', () => {
    for (const p of Object.values(PERMS)) expect(can('supervisor', p)).toBe(true)
    expect(can('distributor', PERMS.CREATE_ORDERS)).toBe(true)
    expect(can('distributor', PERMS.VIEW_REPORTS)).toBe(false)
    expect(can('specialist', PERMS.EXPORT_REPORTS)).toBe(true)
    expect(can('specialist', PERMS.DELETE_ORDERS)).toBe(false)
    expect(can('specialist', PERMS.SEND_NOTES)).toBe(false)
    expect(can('unknown', PERMS.CREATE_ORDERS)).toBe(false)
  })
  it('sends each role to its home page', () => {
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
  it('prevents a supervisor from deleting their own account', async () => {
    query.mockImplementation(sqlRouter((sql, p) => (/select id, role from users/.test(sql) ? [USERS[p[0]]] : [])))
    const res = mockRes()
    await users(mockReq({ method: 'DELETE', user: 'u_sup', body: { id: 'u_sup' } }), res)
    expect(res.statusCode).toBe(400)
  })
})

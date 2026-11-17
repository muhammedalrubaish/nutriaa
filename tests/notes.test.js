// Note 11: notes reach only their audience, carry read receipts for the sender, and only the sender deletes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, sqlRouter, USERS } from './helpers'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendToAll: vi.fn(async () => ({ sent: 1 })) }))
const { query } = await import('@/lib/db')
const { sendToAll } = await import('@/lib/push')
const notes = (await import('@/pages/api/notes')).default
const { validateAudience } = await import('@/lib/notes')

const ALL = Object.values(USERS)

function fakeDb() {
  const state = { notes: [], recipients: [], reads: [] }
  const visible = (n, [username, role, id]) =>
    n.created_by === username || n.audience === 'all' || (n.audience === 'role' && n.target_roles.includes(role)) ||
    (n.audience === 'users' && state.recipients.some((r) => r.note_id === n.id && r.user_id === id))
  const handler = sqlRouter((sql, p) => {
    if (/select id, name, role from users where id = any\(\$1\)/.test(sql)) return ALL.filter((u) => p[0].includes(u.id) && u.id !== p[1])
    if (/select id, name, role from users where role = any\(\$1\)/.test(sql)) return ALL.filter((u) => p[0].includes(u.role) && u.id !== p[1])
    if (/select id, name, role from users where id <> \$1/.test(sql)) return ALL.filter((u) => u.id !== p[0])
    if (/insert into notes/.test(sql)) {
      const n = { id: p[0], message: p[1], department: p[2], created_by: p[3], created_by_name: p[4], audience: p[5], target_roles: p[6], created_at: new Date().toISOString() }
      state.notes.push(n)
      return [n]
    }
    if (/insert into note_recipients/.test(sql)) {
      p[1].forEach((u) => state.recipients.push({ note_id: p[0], user_id: u }))
      return []
    }
    if (/insert into note_reads/.test(sql)) {
      const [username, role, id, ids] = p
      const out = []
      for (const n of state.notes.filter((n) => ids.includes(n.id) && n.created_by !== username && visible(n, p))) {
        if (!state.reads.some((r) => r.note_id === n.id && r.user_id === id)) {
          state.reads.push({ note_id: n.id, user_id: id, read_at: new Date().toISOString() })
          out.push({ note_id: n.id })
        }
      }
      return out
    }
    if (/from notes n\s+left join note_reads/.test(sql)) {
      return state.notes.filter((n) => visible(n, p)).map((n) => ({
        ...n, read_at: state.reads.find((r) => r.note_id === n.id && r.user_id === p[2])?.read_at || null,
      }))
    }
    if (/from notes n\s+join users u/.test(sql)) {
      const [ids, senderId] = p
      const out = []
      for (const n of state.notes.filter((n) => ids.includes(n.id)))
        for (const u of ALL.filter((u) => u.id !== senderId))
          if (n.audience === 'all' || (n.audience === 'role' && n.target_roles.includes(u.role)) ||
              (n.audience === 'users' && state.recipients.some((r) => r.note_id === n.id && r.user_id === u.id)))
            out.push({ note_id: n.id, name: u.name, read_at: state.reads.find((r) => r.note_id === n.id && r.user_id === u.id)?.read_at || null })
      return out
    }
    if (/select created_by from notes where id = \$1/.test(sql)) return state.notes.filter((n) => n.id === p[0])
    if (/delete from notes/.test(sql)) {
      state.notes = state.notes.filter((n) => !(n.id === p[0] && n.created_by === p[1]))
      return []
    }
    return []
  })
  return { state, handler }
}

let db
beforeEach(() => {
  query.mockReset()
  sendToAll.mockClear()
  db = fakeDb()
  query.mockImplementation(db.handler)
})

const call = async (method, user, { body, q = {} } = {}) => {
  const res = mockRes()
  await notes(mockReq({ method, user, body, query: q }), res)
  return res
}
const listFor = async (user) => (await call('GET', user)).body.notes

describe('note audience', () => {
  it('validates the audience', () => {
    expect(validateAudience({})).toEqual({ value: { audience: 'all', roles: [], userIds: [] } })
    expect(validateAudience({ audience: 'role', roles: ['nope'] }).error).toBeTruthy()
    expect(validateAudience({ audience: 'role', roles: ['distributor', 'distributor'] }).value.roles).toEqual(['distributor'])
    expect(validateAudience({ audience: 'users', userIds: [] }).error).toBeTruthy()
  })

  it('a note to specific people is visible only to them and the sender, and pushed only to them', async () => {
    const res = await call('POST', 'u_sup', { body: { message: 'سرّي', audience: 'users', userIds: ['u_dist'] } })
    expect(res.statusCode).toBe(201)
    expect(res.body.note.receipts).toMatchObject({ total: 1, read: 0, pending: ['موزعة'] })
    expect(sendToAll.mock.calls[0][1]).toEqual({ userIds: ['u_dist'], excludeUserId: 'u_sup' })
    expect((await listFor('u_dist')).map((n) => n.message)).toEqual(['سرّي'])
    expect(await listFor('u_spec')).toEqual([])
    expect(await listFor('u_mgr')).toEqual([]) // no blanket access for managers
    expect((await listFor('u_sup'))[0].mine).toBe(true)
  })

  it('a note to a role reaches that role only', async () => {
    await call('POST', 'u_sup', { body: { message: 'للموزعات', audience: 'role', roles: ['distributor'] } })
    expect(await listFor('u_dist')).toHaveLength(1)
    expect(await listFor('u_spec')).toHaveLength(0)
  })

  it('records reads and shows them to the sender', async () => {
    const { body } = await call('POST', 'u_sup', { body: { message: 'للكل' } })
    const id = body.note.id
    expect((await call('PUT', 'u_dist', { body: { ids: [id] } })).body.marked).toBe(1)
    expect((await call('PUT', 'u_dist', { body: { ids: [id] } })).body.marked).toBe(0) // once only
    expect((await call('PUT', 'u_sup', { body: { ids: [id] } })).body.marked).toBe(0) // sender never "reads" own note
    const mine = (await listFor('u_sup'))[0]
    expect(mine.receipts.read).toBe(1)
    expect(mine.receipts.readers.map((r) => r.name)).toEqual(['موزعة'])
    expect(mine.receipts.total).toBe(5)
    expect((await listFor('u_dist'))[0].readAt).toBeTruthy()
  })

  it('cannot mark a note one cannot see', async () => {
    const { body } = await call('POST', 'u_sup', { body: { message: 'x', audience: 'users', userIds: ['u_dist'] } })
    expect((await call('PUT', 'u_spec', { body: { ids: [body.note.id] } })).body.marked).toBe(0)
  })

  it('only the sender can delete a note (for everyone)', async () => {
    const { body } = await call('POST', 'u_sup', { body: { message: 'x' } })
    expect((await call('DELETE', 'u_mgr', { q: { id: body.note.id } })).statusCode).toBe(403)
    expect(db.state.notes).toHaveLength(1)
    expect((await call('DELETE', 'u_sup', { q: { id: body.note.id } })).statusCode).toBe(200)
    expect(db.state.notes).toHaveLength(0)
  })

  it('keeps note sending closed to roles without the permission', async () => {
    expect((await call('POST', 'u_dist', { body: { message: 'x' } })).statusCode).toBe(403)
  })
})

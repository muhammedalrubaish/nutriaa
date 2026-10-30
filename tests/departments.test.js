import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, sqlRouter } from './helpers'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
const { query } = await import('@/lib/db')
const departments = (await import('@/pages/api/departments')).default
const { validateOrder } = await import('@/lib/repo')
const { roomsOf, parseRoomList, validateDept, findOverlaps } = await import('@/lib/departments')
const { parseImport, parseRows } = await import('@/lib/importParser')
const { riyadhDate } = await import('@/lib/time')

const row = (id, name, color, from, to, sort, active = true, extra = []) => ({
  id, name, color, room_from: from, room_to: to, extra_rooms: extra, sort_order: sort, active,
})
const SEED = [
  row('ob1', 'قسم الولادة ١', 'violet', 126, 148, 1),
  row('ob2', 'قسم الولادة ٢', 'sky', 150, 154, 2),
  row('ob3', 'قسم الولادة ٣', 'emerald', 101, 125, 3),
  row('gine', 'قسم الأرحام', 'rose', 326, 348, 4),
  row('old', 'قسم قديم', 'amber', 500, 505, 5, false),
]

beforeEach(() => query.mockReset())

describe('GET /api/departments', () => {
  it('returns active departments with computed rooms', async () => {
    query.mockImplementation(sqlRouter((sql) => (/from departments/.test(sql) ? SEED.filter((d) => !/where active/.test(sql) || d.active) : [])))
    const res = mockRes()
    await departments(mockReq({ user: 'u_dist' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.departments.map((d) => d.id)).toEqual(['ob1', 'ob2', 'ob3', 'gine'])
    expect(res.body.departments[1].rooms).toEqual([150, 151, 152, 153, 154])
  })
  it('includes inactive departments with ?all=1', async () => {
    query.mockImplementation(sqlRouter((sql) => (/from departments/.test(sql) ? SEED.filter((d) => !/where active/.test(sql) || d.active) : [])))
    const res = mockRes()
    await departments(mockReq({ user: 'u_spec', query: { all: '1' } }), res)
    expect(res.body.departments).toHaveLength(5)
  })
  it('requires a session', async () => {
    query.mockImplementation(sqlRouter(() => []))
    const res = mockRes()
    await departments(mockReq(), res)
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/departments', () => {
  it('is manager-only', async () => {
    query.mockImplementation(sqlRouter(() => []))
    const res = mockRes()
    await departments(mockReq({ method: 'POST', user: 'u_spec', body: { name: 'x', roomFrom: 1, roomTo: 2 } }), res)
    expect(res.statusCode).toBe(403)
    expect(query.mock.calls.some(([sql]) => /insert into departments/.test(sql))).toBe(false)
  })
  it('validates the room range', async () => {
    query.mockImplementation(sqlRouter(() => []))
    const res = mockRes()
    await departments(mockReq({ method: 'POST', user: 'u_mgr', body: { name: 'قسم جديد', roomFrom: 20, roomTo: 10 } }), res)
    expect(res.statusCode).toBe(400)
  })
  it('creates a department and warns about overlapping rooms', async () => {
    query.mockImplementation(
      sqlRouter((sql, p) => {
        if (/lower\(name\)/.test(sql)) return []
        if (/insert into departments/.test(sql)) return [row(p[0], p[1], p[2], p[3], p[4], 6, true, p[5])]
        if (/from departments/.test(sql)) return SEED.filter((d) => d.active)
      }),
    )
    const res = mockRes()
    await departments(
      mockReq({ method: 'POST', user: 'u_mgr', body: { name: 'قسم الطوارئ', color: 'teal', roomFrom: 120, roomTo: 130, extraRooms: '200, 210-211' } }),
      res,
    )
    expect(res.statusCode).toBe(201)
    expect(res.body.department.id).toMatch(/^d_[0-9a-f]{16}$/)
    expect(res.body.department.extraRooms).toEqual([200, 210, 211])
    expect(res.body.warnings[0]).toContain('قسم الولادة ١')
    expect(res.body.warnings[0]).toContain('قسم الولادة ٣')
  })
  it('rejects a duplicate name', async () => {
    query.mockImplementation(sqlRouter((sql) => (/lower\(name\)/.test(sql) ? [{ id: 'ob1' }] : [])))
    const res = mockRes()
    await departments(mockReq({ method: 'POST', user: 'u_mgr', body: { name: 'قسم الولادة ١', roomFrom: 1, roomTo: 2 } }), res)
    expect(res.statusCode).toBe(409)
  })
})

describe('PUT /api/departments', () => {
  it('reorders by id list', async () => {
    query.mockImplementation(sqlRouter((sql) => (/from departments/.test(sql) ? SEED : [])))
    const res = mockRes()
    await departments(mockReq({ method: 'PUT', user: 'u_mgr', body: { order: ['gine', 'ob1', 'ob2', 'ob3', 'old'] } }), res)
    expect(res.statusCode).toBe(200)
    const call = query.mock.calls.find(([sql]) => /unnest/.test(sql))
    expect(call[1][0]).toEqual(['gine', 'ob1', 'ob2', 'ob3', 'old'])
  })
  it('updates fields and can deactivate', async () => {
    query.mockImplementation(
      sqlRouter((sql, p) => {
        if (/select \* from departments where id/.test(sql)) return [SEED[1]]
        if (/lower\(name\)/.test(sql)) return []
        if (/update departments set name/.test(sql)) return [row(p[0], p[1], p[2], p[3], p[4], 2, p[6], p[5])]
      }),
    )
    const res = mockRes()
    await departments(mockReq({ method: 'PUT', user: 'u_mgr', body: { id: 'ob2', roomTo: 156, active: false } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.department).toMatchObject({ id: 'ob2', name: 'قسم الولادة ٢', roomTo: 156, active: false })
  })
})

describe('DELETE /api/departments', () => {
  const run = async (hasOrders) => {
    query.mockImplementation(
      sqlRouter((sql) => {
        if (/select id from departments where id/.test(sql)) return [{ id: 'ob1' }]
        if (/from orders where department/.test(sql)) return hasOrders ? [{ '?column?': 1 }] : []
      }),
    )
    const res = mockRes()
    await departments(mockReq({ method: 'DELETE', user: 'u_mgr', query: { id: 'ob1' } }), res)
    return res
  }
  it('deactivates instead of deleting when orders reference it', async () => {
    const res = await run(true)
    expect(res.body).toEqual({ ok: true, deactivated: true })
    expect(query.mock.calls.some(([sql]) => /set active = false/.test(sql))).toBe(true)
    expect(query.mock.calls.some(([sql]) => /delete from departments/.test(sql))).toBe(false)
  })
  it('hard-deletes an unused department', async () => {
    const res = await run(false)
    expect(res.body).toEqual({ ok: true, deleted: true })
  })
})

describe('department helpers and order validation', () => {
  const depts = Object.fromEntries(
    SEED.map((r) => [r.id, { id: r.id, name: r.name, roomFrom: r.room_from, roomTo: r.room_to, extraRooms: r.extra_rooms, active: r.active }]),
  )
  const base = { department: 'ob2', room: '152', bed: 2, patientName: 'س', personType: 'patient', day: 'fri', mealTime: 'lunch', mainMeal: 'وجبة', mealType: 'main' }

  it('computes rooms from range plus extras', () => {
    expect(roomsOf({ roomFrom: 1, roomTo: 3, extraRooms: [10, 2] })).toEqual([1, 2, 3, 10])
    expect(parseRoomList('5, 7-9')).toEqual([5, 7, 8, 9])
    expect(parseRoomList('abc')).toBeNull()
    expect(validateDept({ name: '', roomFrom: 1, roomTo: 2 }).errors.length).toBe(1)
    expect(findOverlaps({ id: 'n', roomFrom: 150, roomTo: 150 }, Object.values(depts))).toEqual(['قسم الولادة ٢'])
  })
  it('rejects a room that does not belong to the department', () => {
    expect(validateOrder(base, depts).value.room).toBe('152')
    expect(validateOrder({ ...base, room: '130' }, depts).error).toContain('لا تتبع')
    expect(validateOrder({ ...base, department: 'old', room: '500' }, depts).error).toBeTruthy()
  })
  it('import recognises Friday/Saturday and DB department names', () => {
    const list = Object.values(depts).filter((d) => d.active)
    const text = 'h\tq\nأ\tالولادة ٢\t150\t1\tمريض\tالجمعة\tغداء\tوجبة\t\t\nب\tقسم الأرحام\t330\t2\tمرافق\tالسبت\tعشاء\tوجبة\t\t\nج\tgine\t130\t2\tمرافق\tالسبت\tعشاء\tوجبة\t\t'
    const rows = parseImport(text, list)
    expect(rows[0]).toMatchObject({ valid: true, department: 'ob2', day: 'fri' })
    expect(rows[1]).toMatchObject({ valid: true, department: 'gine', day: 'sat', personType: 'companion' })
    expect(rows[2].valid).toBe(false)
  })
  it('parses uploaded workbook rows, with beds as 1-4 or A-D', () => {
    const list = Object.values(depts).filter((d) => d.active)
    const rows = parseRows(
      [
        ['header'],
        ['نورة', 'قسم الولادة ١', '128', 'B', 'مريض', 'الأحد', 'غداء', 'وجبة عادية', 'عصير', 'بدون ملح'],
        ['هند', 'قسم الأرحام', '330', '4', 'مرافق', 'الثلاثاء', 'عشاء', 'وجبة', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        ['خطأ', 'قسم الأرحام', '330', 'E', 'مريض', 'الأحد', 'غداء', 'وجبة', '', ''],
      ],
      list,
    )
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ valid: true, department: 'ob1', bed: 2, options: ['عصير'], notes: 'بدون ملح' })
    expect(rows[1]).toMatchObject({ valid: true, department: 'gine', bed: 4, personType: 'companion' })
    expect(rows[2].valid).toBe(false)
  })
  it('computes "today" in Asia/Riyadh', () => {
    expect(riyadhDate(new Date('2026-10-27T21:30:00Z'))).toBe('2026-10-28')
    expect(riyadhDate(new Date('2026-10-27T20:59:00Z'))).toBe('2026-10-27')
  })
})

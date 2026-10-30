import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, sqlRouter } from './helpers'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
const { query } = await import('@/lib/db')
const stats = (await import('@/pages/api/stats')).default
const notifications = (await import('@/pages/api/notifications')).default
const { daysBetween } = await import('@/lib/time')

const DEPTS = [
  { id: 'ob1', name: 'قسم الولادة ١', color: 'violet', room_from: 126, room_to: 148, extra_rooms: [], sort_order: 1, active: true },
  { id: 'gine', name: 'قسم الأرحام', color: 'rose', room_from: 326, room_to: 348, extra_rooms: [], sort_order: 2, active: true },
]
const ROWS = [
  { department: 'ob1', person_type: 'patient', meal_time: 'lunch', created_by: 'dist', created_by_name: 'موزعة', d: '2026-10-05', n: 3 },
  { department: 'ob1', person_type: 'companion', meal_time: 'dinner', created_by: 'dist', created_by_name: 'موزعة', d: '2026-10-12', n: 2 },
  { department: 'gine', person_type: 'patient', meal_time: 'lunch', created_by: 'sup', created_by_name: 'مشرف', d: '2026-10-12', n: 5 },
]

function db(rows = ROWS) {
  return sqlRouter((sql) => {
    if (/from orders/.test(sql) && /group by 1, 2, 3, 4, 5/.test(sql)) return rows
    if (/from departments/.test(sql)) return DEPTS
    if (/group by department/.test(sql)) return [{ department: 'ob1', n: 7 }]
    if (/from users order by name/.test(sql)) return [{ username: 'dist', name: 'موزعة' }, { username: 'sup', name: 'مشرف' }]
    if (/from notes/.test(sql)) return []
    if (/from orders/.test(sql) && /limit 30/.test(sql)) return []
    return []
  })
}

const statsQuery = () => query.mock.calls.find(([sql]) => /group by 1, 2, 3, 4, 5/.test(sql))

beforeEach(() => query.mockReset())

describe('GET /api/stats', () => {
  it('aggregates a custom range and passes Riyadh day bounds', async () => {
    query.mockImplementation(db())
    const res = mockRes()
    await stats(mockReq({ user: 'u_spec', query: { from: '2026-10-01', to: '2026-10-20' } }), res)
    expect(res.statusCode).toBe(200)
    expect(statsQuery()[1]).toEqual(['2026-10-01', '2026-10-20'])
    expect(res.body.summary).toEqual({ total: 10, patient: 8, companion: 2, avgDaily: 0.5 })
    expect(res.body.byDepartment.find((d) => d.id === 'ob1')).toMatchObject({ total: 5, patient: 3, companion: 2 })
    expect(Object.fromEntries(res.body.byUser.map((u) => [u.username, u.total]))).toEqual({ dist: 5, sup: 5 })
    expect(res.body.trend.unit).toBe('day')
    expect(res.body.trend.points).toHaveLength(20)
    expect(res.body.trend.points.find((p) => p.key === '2026-10-12').count).toBe(7)
    // Today's shortfall alerts ignore the filter: ob1 has 7 today, gine none.
    expect(res.body.lowAlerts.map((a) => a.department)).toEqual(['gine'])
  })

  it('filters by user', async () => {
    query.mockImplementation(db())
    const res = mockRes()
    await stats(mockReq({ user: 'u_sup', query: { from: '2026-10-01', to: '2026-10-07', user: 'dist' } }), res)
    expect(res.statusCode).toBe(200)
    expect(statsQuery()[0]).toMatch(/created_by = \$3/)
    expect(statsQuery()[1]).toEqual(['2026-10-01', '2026-10-07', 'dist'])
    expect(res.body.user).toBe('dist')
  })

  it('uses hourly buckets for a single day', async () => {
    query.mockImplementation(db([{ ...ROWS[0], d: '2026-10-05', h: 13 }]))
    const res = mockRes()
    await stats(mockReq({ user: 'u_spec', query: { from: '2026-10-05', to: '2026-10-05' } }), res)
    expect(statsQuery()[0]).toMatch(/extract\(hour/)
    expect(res.body.trend.unit).toBe('hour')
    expect(res.body.trend.points).toHaveLength(24)
    expect(res.body.trend.points[13].count).toBe(3)
  })

  it('groups long ranges by week and month', async () => {
    query.mockImplementation(db())
    let res = mockRes()
    await stats(mockReq({ user: 'u_spec', query: { from: '2026-08-01', to: '2026-10-30' } }), res)
    expect(res.body.trend.unit).toBe('week')
    expect(res.body.trend.points.every((p) => new Date(p.key + 'T00:00:00Z').getUTCDay() === 0)).toBe(true)
    res = mockRes()
    await stats(mockReq({ user: 'u_spec', query: { from: '2026-01-01', to: '2026-10-30' } }), res)
    expect(res.body.trend.unit).toBe('month')
    expect(res.body.trend.points.map((p) => p.key)).toHaveLength(10)
  })

  it('rejects bad or reversed ranges', async () => {
    query.mockImplementation(db())
    for (const q of [{ from: 'x' }, { from: '2026-10-10', to: '2026-10-01' }, { from: '2020-01-01', to: '2026-01-01' }]) {
      const res = mockRes()
      await stats(mockReq({ user: 'u_spec', query: q }), res)
      expect(res.statusCode).toBe(400)
    }
  })

  it('is closed to distributors', async () => {
    query.mockImplementation(db())
    const res = mockRes()
    await stats(mockReq({ user: 'u_dist' }), res)
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /api/notifications', () => {
  const ORDER = {
    id: 'o_1', department: 'ob1', room: '144', bed: 1, patient_name: 'رايد', person_type: 'companion', day: 'thu',
    meal_time: 'lunch', main_meal: 'شيش طاووق', meal_type: 'main', options: [], notes: '', created_by: 'dist',
    created_by_name: 'موزعة', created_at: '2026-10-30T08:00:00Z',
  }
  const withOrders = sqlRouter((sql) => {
    if (/from orders/.test(sql) && /limit 30/.test(sql)) return [ORDER]
    return db()(sql)
  })

  it('lists today\'s new orders for reviewers', async () => {
    query.mockImplementation(withOrders)
    const res = mockRes()
    await notifications(mockReq({ user: 'u_spec' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.orders).toEqual([
      expect.objectContaining({ id: 'o_1', departmentName: 'قسم الولادة ١', room: '144', createdByName: 'موزعة' }),
    ])
    expect(res.body.orders[0].patientName).toBeUndefined()
  })

  it('does not send order notifications to distributors', async () => {
    query.mockImplementation(withOrders)
    const res = mockRes()
    await notifications(mockReq({ user: 'u_dist' }), res)
    expect(res.body.orders).toEqual([])
    expect(query.mock.calls.some(([sql]) => /limit 30/.test(sql))).toBe(false)
  })
})

describe('daysBetween', () => {
  it('counts whole days across month ends', () => {
    expect(daysBetween('2026-10-30', '2026-10-30')).toBe(0)
    expect(daysBetween('2026-09-28', '2026-10-03')).toBe(5)
  })
})

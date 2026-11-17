// Note 7: duplicate orders are keyed on the MEAL's date (meal_date), not the weekday alone and not the entry date.
// The fake DB enforces the same unique slot as db/migrations/005 (department, room, bed, meal_date, meal_time,
// person_type, patient_name), computing meal_date like the generated column, under a fake clock.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockReq, mockRes, sqlRouter } from './helpers'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendToAll: vi.fn(async () => ({ sent: 1 })) }))
const { query } = await import('@/lib/db')
const { sendToAll } = await import('@/lib/push')
const orders = (await import('@/pages/api/orders')).default
const bulk = (await import('@/pages/api/bulk-orders')).default
const { mealDateFor, riyadhDate } = await import('@/lib/time')
const { duplicateMessage } = await import('@/lib/repo')

const DEPT = { id: 'ob1', name: 'قسم الولادة ١', color: 'violet', room_from: 126, room_to: 148, extra_rooms: [], sort_order: 1, active: true }
const BODY = { department: 'ob1', room: '130', bed: 2, patientName: 'نورة', personType: 'patient', day: 'wed', mealTime: 'lunch', mainMeal: 'كبسة' }

// Riyadh is UTC+3: 09:00 Riyadh = 06:00Z.
const TUE = new Date('2026-11-17T06:00:00Z') // Tuesday
const WED = new Date('2026-11-18T06:00:00Z') // Wednesday
const NEXT_TUE = new Date('2026-11-24T06:00:00Z')

const SLOT = ['department', 'room', 'bed', 'meal_date', 'meal_time', 'person_type', 'patient_name']

function fakeDb() {
  const rows = []
  const handler = sqlRouter((sql, p) => {
    if (/from departments/.test(sql)) return [DEPT]
    // Weekly menu: a main meal every day except Friday (QA: no orders for a day without a main meal).
    if (/from menu/.test(sql))
      return ['sun', 'mon', 'tue', 'wed', 'thu', 'sat'].map((day) => ({ day, main_meal: 'كبسة', optional_item: '', optional_item_2: '', optional_item_3: '' }))
    if (/insert into orders/.test(sql)) {
      const created = new Date()
      const row = {
        id: p[0], department: p[1], room: p[2], bed: p[3], patient_name: p[4], person_type: p[5], day: p[6], meal_time: p[7],
        main_meal: p[8], meal_type: p[9], options: JSON.parse(p[10]), notes: p[11], created_by: p[12], created_by_name: p[13],
        created_at: created.toISOString(), meal_date: mealDateFor(riyadhDate(created), p[6]),
      }
      if (rows.some((r) => r.id === row.id)) throw Object.assign(new Error('dup key'), { code: '23505', constraint: 'orders_pkey' })
      if (rows.some((r) => SLOT.every((k) => String(r[k]) === String(row[k]))))
        throw Object.assign(new Error('dup slot'), { code: '23505', constraint: 'orders_unique_slot' })
      rows.push(row)
      return [row]
    }
    if (/select \* from orders where id = \$1/.test(sql)) return rows.filter((r) => r.id === p[0])
    if (/select \* from orders\s+where department = \$1/.test(sql)) {
      const [department, room, bed, mealTime, personType, name, mealDate] = p
      return rows.filter((r) => r.department === department && r.room === room && Number(r.bed) === Number(bed) &&
        r.meal_time === mealTime && r.person_type === personType && r.patient_name === name && r.meal_date === mealDate)
    }
    if (/count\(\*\)::int as n from orders/.test(sql)) return [{ n: rows.length }]
    return []
  })
  return { rows, handler }
}

let db
beforeEach(() => {
  vi.useFakeTimers()
  query.mockReset()
  sendToAll.mockClear()
  db = fakeDb()
  query.mockImplementation(db.handler)
})
afterEach(() => vi.useRealTimers())

async function post(body, user = 'u_dist') {
  const res = mockRes()
  await orders(mockReq({ method: 'POST', user, body }), res)
  return res
}

describe('mealDateFor', () => {
  it('is the nearest date on or after the entry date with that weekday', () => {
    expect(mealDateFor('2026-11-17', 'wed')).toBe('2026-11-18') // Tue -> Wed
    expect(mealDateFor('2026-11-18', 'wed')).toBe('2026-11-18') // Wed -> same day
    expect(mealDateFor('2026-11-18', 'tue')).toBe('2026-11-24') // Wed -> next Tue
    expect(mealDateFor('2026-11-21', 'sun')).toBe('2026-11-22') // Sat -> Sun
    expect(mealDateFor('2026-11-17', 'xxx')).toBeNull()
  })
})

describe('duplicate rule (meal_date)', () => {
  it('blocks Wednesday lunch re-entered on Wednesday after it was entered on Tuesday, naming who and when', async () => {
    vi.setSystemTime(TUE)
    expect((await post(BODY)).statusCode).toBe(201)
    vi.setSystemTime(WED)
    const res = await post(BODY, 'u_spec')
    expect(res.statusCode).toBe(409)
    expect(res.body.duplicate).toMatchObject({ createdByName: 'موزعة', day: 'wed', mealDate: '2026-11-18' })
    expect(res.body.error).toContain('سجّله موزعة')
    expect(res.body.error).toContain('غداء الأربعاء 18/11/2026')
    expect(db.rows).toHaveLength(1)
    // No push for a rejected duplicate.
    expect(sendToAll).toHaveBeenCalledTimes(1)
  })

  it('does not block Tuesday lunch for the same person', async () => {
    vi.setSystemTime(TUE)
    expect((await post(BODY)).statusCode).toBe(201)
    expect((await post({ ...BODY, day: 'tue' })).statusCode).toBe(201)
  })

  it('does not block the same weekday next week', async () => {
    vi.setSystemTime(TUE)
    expect((await post(BODY)).statusCode).toBe(201)
    vi.setSystemTime(NEXT_TUE)
    expect((await post(BODY)).statusCode).toBe(201)
    expect(db.rows.map((r) => r.meal_date)).toEqual(['2026-11-18', '2026-11-25'])
  })

  it('treats another meal time, bed or person type as a different slot', async () => {
    vi.setSystemTime(TUE)
    expect((await post(BODY)).statusCode).toBe(201)
    expect((await post({ ...BODY, mealTime: 'dinner' })).statusCode).toBe(201)
    expect((await post({ ...BODY, bed: 3 })).statusCode).toBe(201)
    expect((await post({ ...BODY, personType: 'companion' })).statusCode).toBe(201)
  })

  it('replays the same submit key as the saved order instead of a duplicate (double tap / retry)', async () => {
    vi.setSystemTime(TUE)
    const key = 'o_0123456789abcdef'
    const first = await post({ ...BODY, id: key })
    expect(first.statusCode).toBe(201)
    expect(first.body.order.id).toBe(key)
    const again = await post({ ...BODY, id: key })
    expect(again.statusCode).toBe(200)
    expect(again.body.order.id).toBe(key)
    expect(db.rows).toHaveLength(1)
    expect(sendToAll).toHaveBeenCalledTimes(1)
  })

  it('ignores a malformed submit key', async () => {
    vi.setSystemTime(TUE)
    const res = await post({ ...BODY, id: "x'; drop table orders" })
    expect(res.statusCode).toBe(201)
    expect(res.body.order.id).toMatch(/^o_[a-f0-9]{16}$/)
  })

  it('reports duplicates in a bulk import with their Excel row numbers', async () => {
    vi.setSystemTime(TUE)
    const res = mockRes()
    await bulk(mockReq({ method: 'POST', user: 'u_mgr', body: { orders: [{ ...BODY, row: 2 }, { ...BODY, row: 5 }] } }), res)
    expect(res.body.imported).toBe(1)
    expect(res.body.duplicates).toBe(1)
    expect(res.body.errors).toEqual([expect.objectContaining({ index: 1, row: 5, duplicate: true })])
  })

  it('duplicateMessage falls back to a generic text without details', () => {
    expect(duplicateMessage(null)).toContain('مسجّل مسبقًا')
  })
})

describe('QA round 1: orders for a day without a main meal', () => {
  it('order entry rejects Friday (no main meal on the menu) with 400', async () => {
    vi.setSystemTime(TUE)
    const res = await post({ ...BODY, day: 'fri' })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('لا توجد وجبة أساسية ليوم الجمعة')
    expect(db.rows).toHaveLength(0)
  })
  it('bulk import rejects the Friday row with its Excel row number and saves the others', async () => {
    vi.setSystemTime(TUE)
    const res = mockRes()
    await bulk(mockReq({ method: 'POST', user: 'u_sys', body: { orders: [{ ...BODY, row: 2 }, { ...BODY, day: 'fri', row: 3 }] } }), res)
    expect(res.body.imported).toBe(1)
    expect(res.body.errors).toEqual([expect.objectContaining({ row: 3, noMain: true, error: expect.stringContaining('الجمعة') })])
    expect(db.rows.map((r) => r.day)).toEqual(['wed'])
  })
})

describe('QA round 1: duplicate alert wording', () => {
  it('uses Arabic ص/م with Latin digits and a d/m/y meal date', () => {
    const msg = duplicateMessage({ mealTime: 'lunch', day: 'wed', mealDate: '2026-11-18', createdByName: 'نورة', createdAt: '2026-11-17T19:05:00Z' })
    expect(msg).toBe('هذا الطلب مسجّل مسبقًا (غداء الأربعاء 18/11/2026) — سجّله نورة في 17/11/2026 10:05 م')
    expect(duplicateMessage({ mealTime: 'lunch', day: 'wed', createdByName: 'x', createdAt: '2026-11-16T21:30:00Z' })).toMatch(/17\/11\/2026 12:30 ص$/)
    expect(msg).not.toMatch(/am|pm/i)
  })
})


describe('QA round 1: the log filters by meal date', () => {
  it('by=meal filters and sorts on meal_date; the default stays on the entry date', async () => {
    const seen = []
    query.mockImplementation(sqlRouter((sql, p) => (/from orders/.test(sql) ? (seen.push({ sql, p }), []) : [])))
    let res = mockRes()
    await orders(mockReq({ method: 'GET', user: 'u_sup', query: { date: '2026-11-18', by: 'meal' } }), res)
    expect(res.statusCode).toBe(200)
    expect(seen[0].sql).toMatch(/coalesce\(meal_date, .*\) >= \$1::date and coalesce\(meal_date, .*\) <= \$2::date/s)
    expect(seen[0].sql).toMatch(/order by coalesce\(meal_date/)
    expect(seen[0].p).toEqual(['2026-11-18', '2026-11-18'])
    res = mockRes()
    await orders(mockReq({ method: 'GET', user: 'u_sup', query: { date: '2026-11-18' } }), res)
    expect(seen[1].sql).toMatch(/created_at >= /)
    expect(seen[1].sql).not.toMatch(/meal_date/)
  })
})

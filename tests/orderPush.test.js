import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, sqlRouter } from './helpers'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendToAll: vi.fn(async () => ({ sent: 1 })) }))
const { query } = await import('@/lib/db')
const { sendToAll } = await import('@/lib/push')
const orders = (await import('@/pages/api/orders')).default
const bulk = (await import('@/pages/api/bulk-orders')).default

const DEPT = { id: 'ob1', name: 'قسم الولادة ١', color: 'violet', room_from: 126, room_to: 148, extra_rooms: [], sort_order: 1, active: true }
const BODY = { department: 'ob1', room: '144', bed: 1, patientName: 'رايد', personType: 'companion', day: 'thu', mealTime: 'lunch', mainMeal: 'شيش طاووق' }

function db() {
  return sqlRouter((sql, params) => {
    if (/from departments/.test(sql)) return [DEPT]
    if (/insert into orders/.test(sql))
      return [{ id: params[0], department: params[1], room: params[2], bed: params[3], patient_name: params[4], person_type: params[5],
        day: params[6], meal_time: params[7], main_meal: params[8], meal_type: params[9], options: [], notes: '',
        created_by: params[12], created_by_name: params[13], created_at: '2026-10-30T08:00:00Z' }]
    if (/select count\(\*\)::int as n from orders/.test(sql)) return [{ n: 23 }]
    return []
  })
}

beforeEach(() => {
  query.mockReset()
  sendToAll.mockClear()
  query.mockImplementation(db())
})

describe('order push notifications', () => {
  it('pushes one collapsing notification to reviewers, not to the sender', async () => {
    const res = mockRes()
    await orders(mockReq({ method: 'POST', user: 'u_dist', body: BODY }), res)
    expect(res.statusCode).toBe(201)
    expect(sendToAll).toHaveBeenCalledTimes(1)
    const [payload, opts] = sendToAll.mock.calls[0]
    expect(payload).toMatchObject({ title: 'طلب جديد — قسم الولادة ١', tag: 'nutri-order', renotify: false, url: '/list' })
    expect(payload.body).toContain('غرفة 144 · سرير A · مرافق · غداء')
    expect(payload.body).toContain('طلبات اليوم: 23')
    expect(payload.body).not.toContain('رايد')
    expect(opts).toEqual({ roles: ['supervisor', 'specialist'], excludeUserId: 'u_dist' })
  })

  it('still saves the order when the push fails', async () => {
    sendToAll.mockRejectedValueOnce(new Error('push down'))
    const res = mockRes()
    await orders(mockReq({ method: 'POST', user: 'u_dist', body: BODY }), res)
    expect(res.statusCode).toBe(201)
  })

  it('does not push for an invalid order', async () => {
    const res = mockRes()
    await orders(mockReq({ method: 'POST', user: 'u_dist', body: { ...BODY, room: '999' } }), res)
    expect(res.statusCode).toBe(400)
    expect(sendToAll).not.toHaveBeenCalled()
  })

  it('sends a single push for a bulk import', async () => {
    const res = mockRes()
    await bulk(mockReq({ method: 'POST', user: 'u_sup', body: { orders: [BODY, BODY, BODY] } }), res)
    expect(res.body.imported).toBe(3)
    expect(sendToAll).toHaveBeenCalledTimes(1)
    expect(sendToAll.mock.calls[0][0].title).toBe('تم استيراد 3 طلب')
  })
})

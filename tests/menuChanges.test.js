import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, sqlRouter } from './helpers'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendToAll: vi.fn(async () => ({ sent: 1 })) }))
const { query } = await import('@/lib/db')
const { sendToAll } = await import('@/lib/push')
const menu = (await import('@/pages/api/menu')).default
const notifications = (await import('@/pages/api/notifications')).default
const staff = (await import('@/pages/api/staff')).default
const { diffMenu } = await import('@/lib/repo')
const { nameLabels } = await import('@/lib/format')

const ROWS = [
  { day: 'sun', main_meal: 'وجبة عادية', optional_item: 'عصير طازج' },
  { day: 'mon', main_meal: 'وجبة دايت', optional_item: 'فاكهة' },
]

/** In-memory menu + settings, enough for the menu and notifications routes. */
function fakeDb() {
  const state = { menu: Object.fromEntries(ROWS.map((r) => [r.day, { ...r }])), changes: null }
  const handler = sqlRouter((sql, params) => {
    if (/select day, main_meal, optional_item from menu/.test(sql)) return Object.values(state.menu)
    if (/insert into menu/.test(sql)) {
      state.menu[params[0]] = { day: params[0], main_meal: params[1], optional_item: params[2] }
      return []
    }
    if (/insert into settings/.test(sql) && params[0] === 'menu_changes') {
      state.changes = [...JSON.parse(params[1]), ...(state.changes || [])].slice(0, 20)
      return []
    }
    if (/from settings where key = \$1/.test(sql)) return state.changes ? [{ value: state.changes }] : []
    if (/from users\s+union all/.test(sql)) return [{ username: 'dist', name: 'سارة' }]
    return []
  })
  return { state, handler }
}

const fullMenu = (over = {}) => ({
  sun: { mainMeal: 'وجبة عادية', optionalItem: 'عصير طازج' },
  mon: { mainMeal: 'وجبة دايت', optionalItem: 'فاكهة' },
  ...over,
})

let db
beforeEach(() => {
  query.mockReset()
  sendToAll.mockClear()
  db = fakeDb()
  query.mockImplementation(db.handler)
})

describe('menu change alerts', () => {
  it('records only the days that changed and pushes them to order-entry staff', async () => {
    const res = mockRes()
    await menu(mockReq({ method: 'PUT', user: 'u_sup', body: { menu: fullMenu({ mon: { mainMeal: 'وجبة لينة', optionalItem: 'فاكهة' } }) } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.changed).toEqual(['mon'])
    expect(db.state.changes).toHaveLength(1)
    expect(db.state.changes[0]).toMatchObject({
      days: [{ day: 'mon', mainMeal: 'وجبة لينة', optionalItem: 'فاكهة' }],
      createdBy: 'sup',
      createdByName: 'مشرف',
    })
    expect(sendToAll).toHaveBeenCalledTimes(1)
    const [payload, opts] = sendToAll.mock.calls[0]
    expect(payload).toMatchObject({ title: 'تم تعديل قائمة الوجبات', url: '/menu', tag: 'nutri-menu' })
    expect(payload.body).toContain('الإثنين: وجبة لينة / فاكهة')
    expect(opts).toEqual({ roles: ['sysadmin', 'manager', 'supervisor', 'specialist', 'distributor'], excludeUserId: 'u_sup' })
  })

  it('stays silent when the saved menu is unchanged', async () => {
    const res = mockRes()
    await menu(mockReq({ method: 'PUT', user: 'u_sup', body: { menu: fullMenu() } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.changed).toEqual([])
    expect(db.state.changes).toBeNull()
    expect(sendToAll).not.toHaveBeenCalled()
  })

  it('still saves the menu when the push fails', async () => {
    sendToAll.mockRejectedValueOnce(new Error('push down'))
    const res = mockRes()
    await menu(mockReq({ method: 'PUT', user: 'u_sup', body: { menu: fullMenu({ sun: { mainMeal: 'كبسة', optionalItem: '' } }) } }), res)
    expect(res.statusCode).toBe(200)
    expect(db.state.menu.sun.main_meal).toBe('كبسة')
  })

  it('shows the change in everyone\'s bell except the editor\'s', async () => {
    await menu(mockReq({ method: 'PUT', user: 'u_sup', body: { menu: fullMenu({ sun: { mainMeal: 'كبسة', optionalItem: '' } }) } }), mockRes())
    let res = mockRes()
    await notifications(mockReq({ user: 'u_dist' }), res)
    expect(res.body.menuChanges).toHaveLength(1)
    expect(res.body.menuChanges[0].days[0]).toMatchObject({ day: 'sun', mainMeal: 'كبسة' })
    res = mockRes()
    await notifications(mockReq({ user: 'u_sup' }), res)
    expect(res.body.menuChanges).toEqual([])
  })

  it('drops changes older than a week from the bell', async () => {
    db.state.changes = [{ id: 'm_old', days: [{ day: 'sun', mainMeal: 'x', optionalItem: '' }], createdBy: 'sup', createdByName: 'مشرف', createdAt: '2020-01-01T00:00:00Z' }]
    const res = mockRes()
    await notifications(mockReq({ user: 'u_dist' }), res)
    expect(res.body.menuChanges).toEqual([])
  })

  it('is still closed to roles without menu editing', async () => {
    for (const user of ['u_dist', 'u_spec']) {
      const res = mockRes()
      await menu(mockReq({ method: 'PUT', user, body: { menu: fullMenu({ sun: { mainMeal: 'x', optionalItem: '' } }) } }), res)
      expect(res.statusCode).toBe(403)
    }
    expect(db.state.changes).toBeNull()
  })

  it('diffMenu compares both fields per day', () => {
    const a = { sun: { mainMeal: 'a', optionalItem: 'b' }, mon: { mainMeal: 'c', optionalItem: '' } }
    expect(diffMenu(a, { ...a, mon: { mainMeal: 'c', optionalItem: 'd' } })).toEqual([{ day: 'mon', mainMeal: 'c', optionalItem: 'd' }])
    expect(diffMenu(a, a)).toEqual([])
  })
})

describe('order log user filter', () => {
  it('serves names to report viewers but not to distributors', async () => {
    let res = mockRes()
    await staff(mockReq({ user: 'u_spec' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.users).toEqual([{ username: 'dist', name: 'سارة' }])
    res = mockRes()
    await staff(mockReq({ user: 'u_dist' }), res)
    expect(res.statusCode).toBe(403)
  })

  it('labels users by name only, numbering duplicates', () => {
    const labels = nameLabels([
      { username: 'a', name: 'سارة' },
      { username: 'b', name: 'نورة' },
      { username: 'c', name: 'سارة' },
    ]).map((u) => u.label)
    expect(labels).toEqual(['سارة (1)', 'نورة', 'سارة (2)'])
    expect(labels.join(' ')).not.toMatch(/[abc]/)
  })
})

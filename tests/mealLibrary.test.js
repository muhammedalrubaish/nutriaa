import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, sqlRouter } from './helpers'
import { MAIN_MEALS, OPTIONAL_ITEMS } from '@/lib/constants'
import { filterMealLibrary, groupMealLibrary, mealPickerNames } from '@/lib/mealLibrary'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
const { query } = await import('@/lib/db')
const mealsApi = (await import('@/pages/api/meals')).default

const lib = [
  { id: 'm1', name: 'وجبة عادية', category: 'main', active: true },
  { id: 'm2', name: 'عصير طازج', category: 'optional', active: true },
  { id: 'm3', name: 'وجبة مشتركة', category: 'any', active: true },
]

describe('mealPickerNames', () => {
  it('falls back to the fixed lists when the library is empty', () => {
    expect(mealPickerNames([], [])).toEqual({
      main: [...MAIN_MEALS].sort((a, b) => a.localeCompare(b, 'ar')),
      optional: [...OPTIONAL_ITEMS].sort((a, b) => a.localeCompare(b, 'ar')),
    })
  })

  it('uses library names and still offers fixed-list names the library never stored', () => {
    const names = mealPickerNames(lib, [])
    expect(names.main).toEqual(expect.arrayContaining(['وجبة عادية', 'وجبة مشتركة', 'وجبة دايت']))
    expect(names.optional).toEqual(expect.arrayContaining(['عصير طازج', 'وجبة مشتركة', 'فاكهة']))
    expect(names.main).not.toContain('عصير طازج')
    expect(names.optional).not.toContain('وجبة عادية')
  })

  it('keeps a deleted library name out of the dropdown even if it is in the fixed lists', () => {
    const names = mealPickerNames(
      lib.filter((m) => m.name !== 'وجبة عادية'),
      ['وجبة عادية', 'فاكهة'],
    )
    expect(names.main).not.toContain('وجبة عادية')
    expect(names.optional).not.toContain('فاكهة')
    expect(names.main).toEqual(expect.arrayContaining(['وجبة دايت', 'وجبة مشتركة']))
    expect(names.optional).toEqual(expect.arrayContaining(['عصير طازج', 'زبادي']))
  })

  it('sorts Arabic names and de-duplicates by case and spaces', () => {
    const names = mealPickerNames(
      [
        { name: 'وجبة دايت', category: 'main' },
        { name: '  وجبة دايت  ', category: 'main' },
      ],
      [],
      { main: ['وجبة دايت'], optional: [] },
    )
    expect(names.main.filter((n) => n.trim().toLowerCase() === 'وجبة دايت')).toHaveLength(1)
  })
})

describe('filterMealLibrary / groupMealLibrary', () => {
  it('filters by category (including «any») and search, and groups the rest', () => {
    const mains = filterMealLibrary(lib, { category: 'main' }).map((m) => m.name)
    expect(mains).toEqual(['وجبة عادية', 'وجبة مشتركة'])
    const found = filterMealLibrary(lib, { query: 'عصير' }).map((m) => m.name)
    expect(found).toEqual(['عصير طازج'])
    const groups = groupMealLibrary(lib)
    expect(groups.map((g) => [g.id, g.items.map((i) => i.name)])).toEqual([
      ['main', ['وجبة عادية']],
      ['optional', ['عصير طازج']],
      ['any', ['وجبة مشتركة']],
    ])
  })
})

function fakeMealsDb(rows) {
  const state = { rows: rows.map((r) => ({ ...r })) }
  const handler = sqlRouter((sql, params) => {
    if (/from meal_library/.test(sql) && /order by name/.test(sql) && /select id, name, category/.test(sql)) {
      return [...state.rows].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    }
    if (/insert into meal_library/.test(sql)) {
      const names = params[0]
      const category = params[1]
      for (const n of names) {
        if (!state.rows.some((r) => r.name.trim().toLowerCase() === n.trim().toLowerCase())) {
          state.rows.push({ id: 'm_new_' + n, name: n, category, active: true })
        }
      }
      return []
    }
    if (/update meal_library set active = true/.test(sql)) {
      for (const r of state.rows) {
        if (r.name.trim().toLowerCase() === String(params[0]).trim().toLowerCase()) r.active = true
      }
      return []
    }
    if (/update meal_library set active = false where id = \$1/.test(sql)) {
      const row = state.rows.find((r) => r.id === params[0])
      if (row) row.active = false
      return []
    }
    return []
  })
  return { state, handler }
}

let db
beforeEach(() => {
  query.mockReset()
  db = fakeMealsDb([
    { id: 'm1', name: 'وجبة عادية', category: 'main', active: true },
    { id: 'm_hid', name: 'ماء', category: 'optional', active: false },
  ])
  query.mockImplementation(db.handler)
})

describe('GET /api/meals', () => {
  it('is open to roles that enter orders and lists active meals plus hidden names', async () => {
    const res = mockRes()
    await mealsApi(mockReq({ user: 'u_dist' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.meals).toEqual([{ id: 'm1', name: 'وجبة عادية', category: 'main', active: true }])
    expect(res.body.hidden).toEqual(['ماء'])
  })

  it('rejects a logged-out request', async () => {
    const res = mockRes()
    await mealsApi(mockReq({}), res)
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/meals', () => {
  it('is closed to roles that cannot edit the menu', async () => {
    const res = mockRes()
    await mealsApi(mockReq({ method: 'POST', user: 'u_dist', body: { name: 'شوربة', category: 'optional' } }), res)
    expect(res.statusCode).toBe(403)
  })

  it('requires a name', async () => {
    const res = mockRes()
    await mealsApi(mockReq({ method: 'POST', user: 'u_sup', body: { name: '  ', category: 'main' } }), res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('اكتب اسم الوجبة')
  })

  it('adds a meal and reactivates a previously hidden name', async () => {
    const res = mockRes()
    await mealsApi(mockReq({ method: 'POST', user: 'u_sup', body: { name: 'ماء', category: 'optional' } }), res)
    expect(res.statusCode).toBe(201)
    expect(db.state.rows.find((r) => r.name === 'ماء').active).toBe(true)
  })
})

describe('DELETE /api/meals', () => {
  it('hides a meal by id for a menu editor', async () => {
    const res = mockRes()
    await mealsApi(mockReq({ method: 'DELETE', user: 'u_sup', query: { id: 'm1' } }), res)
    expect(res.statusCode).toBe(200)
    expect(db.state.rows.find((r) => r.id === 'm1').active).toBe(false)
  })

  it('requires an id and the edit-menu permission', async () => {
    let res = mockRes()
    await mealsApi(mockReq({ method: 'DELETE', user: 'u_sup', query: {} }), res)
    expect(res.statusCode).toBe(400)
    res = mockRes()
    await mealsApi(mockReq({ method: 'DELETE', user: 'u_spec', query: { id: 'm1' } }), res)
    expect(res.statusCode).toBe(403)
    expect(db.state.rows.find((r) => r.id === 'm1').active).toBe(true)
  })
})

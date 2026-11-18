// Meal-library helpers for the menu-page pickers and the «إدارة الوجبات» manager.
import { MAIN_MEALS, OPTIONAL_ITEMS } from '@/lib/constants'

export const MEAL_CATEGORY_LABELS = {
  main: 'أساسية',
  optional: 'اختيارية',
  any: 'للكل',
}

export const MEAL_CATEGORY_OPTIONS = [
  { id: 'main', name: MEAL_CATEGORY_LABELS.main },
  { id: 'optional', name: MEAL_CATEGORY_LABELS.optional },
  { id: 'any', name: MEAL_CATEGORY_LABELS.any },
]

const keyOf = (n) => (n || '').trim().toLowerCase()

/**
 * Names for the searchable menu pickers.
 * Active library rows win. The old fixed lists (MAIN_MEALS / OPTIONAL_ITEMS) are
 * merged only for names the library has never stored, so a hidden library item
 * — including one that matches a fixed list — stays out of the dropdown.
 */
export function mealPickerNames(meals = [], hidden = [], extras = {}) {
  const mainExtras = extras.main ?? MAIN_MEALS
  const optionalExtras = extras.optional ?? OPTIONAL_ITEMS
  const known = new Set()
  for (const n of hidden) {
    const k = keyOf(n)
    if (k) known.add(k)
  }
  for (const m of meals) {
    const k = keyOf(m?.name)
    if (k) known.add(k)
  }
  const pick = (cat, extra) => {
    const set = new Map()
    for (const m of meals) {
      if (!m?.name) continue
      if (m.category !== cat && m.category !== 'any') continue
      const k = keyOf(m.name)
      if (k && !set.has(k)) set.set(k, m.name.trim())
    }
    for (const n of extra) {
      const k = keyOf(n)
      if (k && !known.has(k) && !set.has(k)) set.set(k, n.trim())
    }
    return [...set.values()].sort((a, b) => a.localeCompare(b, 'ar'))
  }
  return { main: pick('main', mainExtras), optional: pick('optional', optionalExtras) }
}

/** Groups active meals for the manager list, optionally filtered by category and search. */
export function filterMealLibrary(meals = [], { category = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase()
  return meals.filter((m) => {
    if (!m?.name) return false
    if (category === 'main' && m.category !== 'main' && m.category !== 'any') return false
    if (category === 'optional' && m.category !== 'optional' && m.category !== 'any') return false
    if (q && !m.name.toLowerCase().includes(q)) return false
    return true
  })
}

export function groupMealLibrary(meals) {
  const groups = [
    { id: 'main', name: MEAL_CATEGORY_LABELS.main, items: [] },
    { id: 'optional', name: MEAL_CATEGORY_LABELS.optional, items: [] },
    { id: 'any', name: MEAL_CATEGORY_LABELS.any, items: [] },
  ]
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]))
  for (const m of meals) {
    ;(byId[m.category] || byId.any).items.push(m)
  }
  for (const g of groups) g.items.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  return groups.filter((g) => g.items.length)
}

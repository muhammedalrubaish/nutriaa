// Pure aggregation helpers shared by /api/stats and the report builders.

/**
 * Meals ranked by how often they were ordered (note 5): [{ name, total, patient, companion, pct, mealType }],
 * most ordered first; ties by name. `pct` is the share of all orders in the period, one decimal.
 */
export function rankMeals(rows = []) {
  const by = {}
  let all = 0
  for (const r of rows) {
    if (!r.name) continue
    const m = (by[r.name] ||= { name: r.name, total: 0, patient: 0, companion: 0, types: {} })
    m.total += r.n
    m[r.person_type] = (m[r.person_type] || 0) + r.n
    m.types[r.meal_type] = (m.types[r.meal_type] || 0) + r.n
    all += r.n
  }
  return Object.values(by)
    .map(({ types, ...m }) => ({
      ...m,
      mealType: Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'main',
      pct: all ? Math.round((m.total / all) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'))
}

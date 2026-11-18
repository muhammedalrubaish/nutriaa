import { describe, it, expect } from 'vitest'
import { rankMeals as apiRank } from '@/lib/stats'
import { computeStats, rankMeals, topBottom } from '@/lib/report/stats'
import { reportPages } from '@/lib/report/report'
import { readFileSync } from 'node:fs'

// Abdullah 19 Nov «لاتضيف الوجبات المخصصه لهذه الاحصائيات»: custom meals are temporary, per patient wish.
const o = (mainMeal, mealType, personType = 'patient', i = 0) => ({ id: mainMeal + i, mainMeal, mealType, personType, department: 'd1', mealTime: 'lunch', day: 'sun', createdBy: 'u', createdByName: 'U', createdAt: '2026-11-18T09:00:00+03:00' })
const orders = [
  ...Array.from({ length: 6 }, (_, i) => o('كبسة', 'main', i % 2 ? 'companion' : 'patient', i)),
  ...Array.from({ length: 4 }, (_, i) => o('فاكهة', 'optional', 'patient', i)),
  ...Array.from({ length: 5 }, (_, i) => o('WHITE RICE // LF', 'custom', 'patient', i)),
  o('RICE MEAT', 'custom'),
]

describe('custom meals are left out of per-meal statistics', () => {
  it('dashboard API ranking skips custom rows and shares are over the rest', () => {
    const r = apiRank([
      { name: 'كبسة', person_type: 'patient', meal_type: 'main', n: 6 },
      { name: 'فاكهة', person_type: 'patient', meal_type: 'optional', n: 4 },
      { name: 'WHITE RICE // LF', person_type: 'patient', meal_type: 'custom', n: 5 },
    ])
    expect(r.map((m) => [m.name, m.total, m.pct])).toEqual([['كبسة', 6, 60], ['فاكهة', 4, 40]])
  })
  it('all-time comparison query excludes custom meals', () => {
    expect(readFileSync(new URL('../pages/api/stats.js', import.meta.url), 'utf8')).toMatch(/from orders where meal_type is distinct from 'custom' group by 1/)
  })
  it('report ranking, top/bottom and comparison skip custom meals; totals keep them', () => {
    const ranks = rankMeals(orders, null)
    expect(ranks.map((m) => m.name)).toEqual(['كبسة', 'فاكهة'])
    expect(ranks.reduce((s, m) => s + m.pct, 0)).toBe(100)
    const tb = topBottom(ranks)
    expect([...tb.top, ...tb.bottom].some((m) => /RICE/.test(m.name))).toBe(false)
    const stats = computeStats(orders, { from: '2026-11-18', to: '2026-11-18', minDaily: 0, departments: [{ id: 'd1', name: 'قسم', color: 'sky' }], users: [], menu: null })
    expect(stats.summary.total).toBe(16)
    expect(stats.summary.custom).toBe(6)
    expect(stats.byMealType.find((t) => t.id === 'custom')?.count).toBe(6)
    const html = reportPages({ title: 't', periodLabel: 'p', filtersLabel: '', generatedAt: new Date(), generatedBy: 'x', origin: '', departments: { d1: { name: 'قسم' } }, orders, stats }).join('')
    const rankingAndCharts = html.slice(0, html.indexOf('تفاصيل الطلبات'))
    expect(rankingAndCharts).not.toMatch(/WHITE RICE|RICE MEAT/)
    expect(html.slice(html.indexOf('تفاصيل الطلبات'))).toMatch(/WHITE RICE/) // order details keep custom orders
  })
})

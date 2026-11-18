import { describe, it, expect } from 'vitest'
import { packTables } from '../lib/report/report.js'
import { printSheetExtraMm } from '../lib/printView.js'

const t = (key, n, h = 10) => ({ key, rows: Array.from({ length: n }, (_, i) => i + 1), height: () => h })
const flat = pages => pages.map(p => p.map(s => [s.table.key, s.start, s.rows.length]))

describe('packTables', () => {
  it('fills a sheet by height and continues numbering (0-based start)', () => {
    const pages = packTables([t('a', 25)], { page: 100, card: 20, gap: 3 })
    expect(flat(pages)).toEqual([[['a', 0, 8]], [['a', 8, 8]], [['a', 16, 5]], [['a', 21, 4]]])
  })
  it('starts the next table on the same sheet when enough rows fit', () => {
    const pages = packTables([t('a', 3), t('b', 20)], { page: 120, card: 20, gap: 3 })
    expect(pages[0].map(s => s.table.key)).toEqual(['a', 'b'])
    const b = pages.flat().filter(s => s.table.key === 'b')
    expect(b[0].start).toBe(0)
    b.slice(1).forEach((s, i) => expect(s.start).toBe(b[i].start + b[i].rows.length))
    expect(b.reduce((n, s) => n + s.rows.length, 0)).toBe(20)
  })
  it('does not start a table with only a row or two at the bottom', () => {
    const pages = packTables([t('a', 6), t('b', 10)], { page: 100, card: 20, gap: 3 })
    expect(pages[0].map(s => s.table.key)).toEqual(['a'])
  })
  it('never exceeds the sheet budget', () => {
    const tabs = [t('a', 41, 7), { key: 'b', rows: Array.from({ length: 277 }, (_, i) => i), height: (_, i) => 6 + (i % 3) * 4 }]
    for (const page of packTables(tabs, { page: 201, card: 21, gap: 3 })) {
      const used = page.reduce((s, seg, j) => s + 21 + (j ? 3 : 0) + seg.rows.reduce((x, r) => x + seg.table.height(r, seg.rows.indexOf(r) + seg.start), 0), 0)
      expect(used).toBeLessThanOrEqual(201)
    }
  })
  it('balances a near-empty final sheet', () => {
    const pages = packTables([t('a', 18)], { page: 100, card: 20, gap: 3 })
    const last = pages.at(-1)[0], prev = pages.at(-2).at(-1)
    expect(last.rows.length).toBeGreaterThanOrEqual(prev.rows.length - 1)
  })
})

describe('printSheetExtraMm', () => {
  it('matches the sheet height per platform', () => {
    expect(printSheetExtraMm({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 })).toBe(21)
    expect(printSheetExtraMm({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 })).toBe(0)
  })
})

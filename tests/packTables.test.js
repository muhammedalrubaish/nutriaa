import { describe, it, expect } from 'vitest'
import { packTables } from '../lib/report/report.js'
import { printSheetExtraMm } from '../lib/printView.js'

const t = (key, n, h = 10) => ({ key, rows: Array.from({ length: n }, (_, i) => i + 1), height: () => h })
const flat = pages => pages.map(p => p.map(s => [s.table.key, s.start, s.rows.length]))

describe('packTables', () => {
  it('fills a sheet by height and continues numbering (0-based start)', () => {
    const pages = packTables([t('a', 25)], { page: 100, card: 20, gap: 3 })
    expect(flat(pages)).toEqual([[['a', 0, 8]], [['a', 8, 8]], [['a', 16, 8]], [['a', 24, 1]]])
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
  it('starts the next table under the previous one only when its title, header and 3 rows fit', () => {
    expect(flat(packTables([t('a', 4), t('b', 10)], { page: 100, card: 20, gap: 3 }))[0]).toEqual([['a', 4 - 4, 4]])
    const pages = packTables([t('a', 2), t('b', 10)], { page: 100, card: 20, gap: 3 })
    expect(flat(pages)[0]).toEqual([['a', 0, 2], ['b', 0, 3]])
    expect(flat(pages)[1]).toEqual([['b', 3, 7]])
  })
  it('keeps an optional last-sheet reserve even when all tables fit one sheet', () => {
    // 2 + 3 rows fill the sheet exactly; the note (6mm) no longer fits, so the last rows move on.
    const pages = packTables([t('a', 2), t('b', 3)], { page: 93, card: 20, gap: 3, tail: 6 })
    const used = (p) => p.reduce((s, seg, j) => s + 20 + (j ? 3 : 0) + seg.rows.length * 10, 0)
    expect(used(pages.at(-1)) + 6).toBeLessThanOrEqual(93)
    expect(pages.flat().filter(s => s.table.key === 'b').reduce((n, s) => n + s.rows.length, 0)).toBe(3)
  })
  it('reserves the optional tail only on the last sheet', () => {
    expect(flat(packTables([t('a', 16)], { page: 100, card: 20, gap: 3, tail: 6 }))).toEqual([[['a', 0, 8]], [['a', 8, 7]], [['a', 15, 1]]])
    expect(flat(packTables([t('a', 15)], { page: 100, card: 20, gap: 3, tail: 6 }))).toEqual([[['a', 0, 8]], [['a', 8, 7]]])
  })
})

describe('printSheetExtraMm', () => {
  it('matches the sheet height per platform', () => {
    expect(printSheetExtraMm({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 })).toBe(21)
    expect(printSheetExtraMm({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 })).toBe(0)
  })
})

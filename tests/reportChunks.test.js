import { describe, it, expect } from 'vitest'
import { chunkRows, rowHeightMm, TABLE_BUDGET_MM } from '@/lib/report/report'

describe('report table sheets (Abdullah 18 Nov: row 30 of «ترتيب الوجبات» sat under the footer)', () => {
  it('splits by estimated height and max rows, keeping every row in order', () => {
    const rows = Array.from({ length: 61 }, (_, i) => ({ i, name: i % 2 ? 'دجاج كاري' : 'لحم طاجن مع الأرز + موز تجريبي مع سلطة خضراء وصلصة الطماطم الحارة' }))
    const h = (r) => rowHeightMm([[r.name, 190 * 0.41]])
    const chunks = chunkRows(rows, h, { maxRows: 28 })
    expect(chunks.flat().map((r) => r.i)).toEqual(rows.map((r) => r.i))
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(28)
      expect(c.reduce((s, r) => s + h(r), 0)).toBeLessThanOrEqual(TABLE_BUDGET_MM)
    }
  })

  it('estimates taller rows for wrapping text', () => {
    expect(rowHeightMm([['قصير', 30]])).toBe(6.6)
    expect(rowHeightMm([['عبدالرحمن بن محمد بن عبدالله بن سليمان الفلاني القحطاني الشمري', 33]])).toBeGreaterThan(8)
  })
})

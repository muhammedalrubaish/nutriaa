// Note 9 + QA: menu import from Excel and order import keep the real Excel row numbers.
import { describe, it, expect } from 'vitest'
import { parseMenuSheet } from '@/lib/menuImport'
import { parseImport, parseRows } from '@/lib/importParser'
import { splitNav, MAX_BOTTOM } from '@/lib/nav'
import { rankMeals } from '@/lib/stats'

const row = (n, cells) => Object.assign(cells, { rowNumber: n })
const CURRENT = { sun: { mainMeal: 'قديم', optionalItem: '', optionalItem2: '', optionalItem3: '' } }

describe('menu import', () => {
  it('reads three optional meals per day and keeps days not in the file', () => {
    const { draft, errors, days } = parseMenuSheet(
      [row(1, ['اليوم', 'الأساسية']), row(2, ['الاثنين', 'كبسة', 'فاكهة', 'زبادي', 'سلطة'])],
      CURRENT,
    )
    expect(errors).toEqual([])
    expect(days).toEqual(['mon'])
    expect(draft.mon).toEqual({ mainMeal: 'كبسة', optionalItem: 'فاكهة', optionalItem2: 'زبادي', optionalItem3: 'سلطة' })
    expect(draft.sun.mainMeal).toBe('قديم')
  })

  it('rejects optional meals without a main meal, quoting the real Excel row (blank rows counted)', () => {
    const { errors } = parseMenuSheet([row(1, ['اليوم']), row(4, ['الثلاثاء', '', 'فاكهة'])], CURRENT)
    expect(errors).toEqual([expect.stringContaining('الصف 4: وجبات اختيارية بدون وجبة أساسية لـالثلاثاء')])
  })

  it('QA: the downloaded template re-imports unchanged (empty Friday/Saturday rows are not errors)', () => {
    const tpl = [row(1, ['اليوم', 'الوجبة الأساسية', 'الوجبة الاختيارية 1', 'الوجبة الاختيارية 2', 'الوجبة الاختيارية 3']),
      row(2, ['الأحد', 'وجبة عادية', 'عصير']), row(3, ['الاثنين', 'وجبة دايت']), row(4, ['الثلاثاء', 'سكري']),
      row(5, ['الأربعاء', 'ضغط']), row(6, ['الخميس', 'عادية']), row(7, ['الجمعة']), row(8, ['السبت', '', '', '', ''])]
    const { errors, draft, days } = parseMenuSheet(tpl, CURRENT)
    expect(errors).toEqual([])
    expect(days).toHaveLength(7)
    expect(draft.fri).toEqual({ mainMeal: '', optionalItem: '', optionalItem2: '', optionalItem3: '' })
  })

  it('QA: ignores a title row above the header row', () => {
    const { errors, days } = parseMenuSheet([row(1, ['القائمة الأسبوعية — نيوتريا']), row(2, ['اليوم', 'الوجبة الأساسية']), row(3, ['الأحد', 'كبسة'])], CURRENT)
    expect(errors).toEqual([])
    expect(days).toEqual(['sun'])
  })

  it('rejects unknown and repeated days and an empty file', () => {
    expect(parseMenuSheet([row(3, ['يوم؟', 'x'])], CURRENT).errors[0]).toContain('الصف 3')
    const rep = parseMenuSheet([row(2, ['الأحد', 'a']), row(7, ['الاحد', 'b'])], CURRENT).errors
    expect(rep).toEqual([expect.stringContaining('الصف 7: الأحد مكرر (سبق في الصف 2)')])
    expect(parseMenuSheet([], CURRENT).errors).toEqual(['لم يتم العثور على أي يوم في الملف'])
  })
})

describe('order import row numbers', () => {
  const DEPTS = [{ id: 'ob1', name: 'قسم الولادة ١', roomFrom: 126, roomTo: 148, extraRooms: [], rooms: [], active: true }]
  it('uses the Excel row number from readXlsxRows', () => {
    const rows = parseRows([row(1, ['h']), row(6, ['نورة', 'ob1', '130', '1', 'مريض', 'الأحد', 'غداء', 'كبسة'])], DEPTS)
    expect(rows[0].row).toBe(6)
  })
  it('numbers pasted lines by their own line number', () => {
    const rows = parseImport('h\tx\n\nنورة\tob1\t130\t1\tمريض\tالأحد\tغداء\tكبسة', DEPTS)
    expect(rows[0].row).toBe(3)
  })
})

describe('mobile nav «المزيد»', () => {
  it('keeps at most 5 bottom slots: 4 tabs + «المزيد»', () => {
    const items = Array.from({ length: 8 }, (_, i) => i)
    expect(MAX_BOTTOM).toBe(5)
    expect(splitNav(items)).toEqual({ shown: [0, 1, 2, 3], more: [4, 5, 6, 7] })
    expect(splitNav([0, 1, 2, 3, 4])).toEqual({ shown: [0, 1, 2, 3, 4], more: [] })
  })
})

describe('meal ranking (note 5)', () => {
  it('ranks meals with shares and patient/companion split', () => {
    const r = rankMeals([
      { name: 'كبسة', person_type: 'patient', meal_type: 'main', n: 3 },
      { name: 'كبسة', person_type: 'companion', meal_type: 'main', n: 1 },
      { name: 'فاكهة', person_type: 'patient', meal_type: 'optional', n: 4 },
      { name: 'شوربة', person_type: 'companion', meal_type: 'custom', n: 2 },
    ])
    expect(r.map((m) => [m.name, m.total, m.pct])).toEqual([['فاكهة', 4, 40], ['كبسة', 4, 40], ['شوربة', 2, 20]])
    expect(r.find((m) => m.name === 'كبسة')).toMatchObject({ patient: 3, companion: 1, mealType: 'main' })
  })
})

import { safeFileName } from '@/lib/fileName'
import { clip } from '@/lib/report/common'

describe('QA round 1: download file names', () => {
  it('drops arrows, bidi marks and reserved characters, keeps Arabic and the extension', () => {
    expect(safeFileName('تقرير لوحة المؤشرات-2026-11-01 → 2026-11-17.xlsx')).toBe('تقرير_لوحة_المؤشرات-2026-11-01_2026-11-17.xlsx')
    expect(safeFileName('a/b:c*?\u200f.pdf')).toBe('a_b_c.pdf')
    expect(safeFileName('تقرير سجل الطلبات - 2026-11-01 إلى 2026-11-17.pdf')).toBe('تقرير_سجل_الطلبات-2026-11-01_إلى_2026-11-17.pdf')
    expect(safeFileName('→')).toBe('nutriaa')
  })
})

describe('QA round 1: text shortened in code, not by CSS ellipsis (PDF renderer)', () => {
  it('keeps the start of the text in logical order and ends with «…»', () => {
    expect(clip('مريض تجريبي 12', 40)).toBe('مريض تجريبي 12')
    expect(clip('عبدالرحمن بن محمد بن عبدالله آل سعود الطويل جداً', 20)).toBe('عبدالرحمن بن محمد…')
    expect(Array.from(clip('x'.repeat(50), 20))).toHaveLength(20)
  })
})


describe('QA round 1: report table cells', () => {
  it('wraps cells (no CSS ellipsis) and widens name / entered-by columns', async () => {
    const { REPORT_CSS } = await import('@/lib/report/report')
    const { CHART_CSS } = await import('@/lib/report/html')
    expect(REPORT_CSS + CHART_CSS).not.toMatch(/text-overflow/)
    expect(REPORT_CSS).toMatch(/table\.t td\{[^}]*white-space:normal/)
  })
})

describe('QA round 1: mixed Arabic/Latin text in the PDF', () => {
  it('isolates Latin runs with their brackets so the PDF renderer keeps them in order', async () => {
    const { bidiHtml } = await import('@/lib/report/common')
    expect(bidiHtml('ناديه(m)')).toBe('ناديه<span dir="ltr" style="unicode-bidi:isolate">(m)</span>')
    expect(bidiHtml('RICE MEAT')).toBe('RICE MEAT') // no Arabic: untouched
    expect(bidiHtml('دجاج <b>')).not.toContain('<b>')
    expect(bidiHtml('دجاج <b>')).toContain('&lt;')
    expect(bidiHtml('غرفة 120-B')).toBe('غرفة <span dir="ltr" style="unicode-bidi:isolate">120-B</span>')
  })
})

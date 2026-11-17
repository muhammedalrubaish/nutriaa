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

  it('rejects a day without a main meal, quoting the real Excel row (blank rows counted)', () => {
    const { errors } = parseMenuSheet([row(1, ['اليوم']), row(4, ['الثلاثاء', '', 'فاكهة'])], CURRENT)
    expect(errors).toEqual([expect.stringContaining('الصف 4: لا توجد وجبة أساسية لـالثلاثاء')])
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

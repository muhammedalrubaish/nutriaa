// Note 9: weekly-menu import from Excel. Pure parser (tested); the menu page reads the file with
// readXlsxRows (real Excel row numbers), shows a preview, and saves only when there are no errors.
import { WEEK_DAYS, DAY_BY_ID } from './constants'

export const MENU_TEMPLATE_HEADER = ['اليوم', 'الوجبة الأساسية', 'الوجبة الاختيارية 1', 'الوجبة الاختيارية 2', 'الوجبة الاختيارية 3']

const clean = (s, max = 200) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

// Spelling-tolerant: hamza forms of alef (أ إ آ → ا), with or without "ال", spaces ignored, case-insensitive.
const norm = (t) => clean(t).replace(/[أإآ]/g, 'ا').replace(/\s/g, '').toLowerCase()
const DAY_ALIASES = Object.fromEntries(
  WEEK_DAYS.flatMap((d) => [[norm(d.name), d.id], [d.id, d.id], [norm(d.name).replace(/^ال/, ''), d.id]]),
)

export const dayFromText = (t) => DAY_ALIASES[norm(t)] ?? DAY_ALIASES[norm(t).replace(/^ال/, '')]

/**
 * Parses the weekly-menu sheet. `rows` are arrays of cell text, each with `rowNumber` (the real Excel row);
 * falls back to position + 1. Returns { draft, errors, days }. Errors block saving: an unknown day, a day
 * without a main meal, a day listed twice, or no days at all. Days not in the file keep their current menu.
 */
export function parseMenuSheet(rows, current = {}) {
  const draft = Object.fromEntries(WEEK_DAYS.map((d) => [d.id, { ...(current[d.id] || {}) }]))
  const errors = []
  const seen = new Map()
  rows.forEach((c, idx) => {
    const row = c.rowNumber || idx + 1
    if (!c.some((x) => clean(x))) return
    if (idx === 0 && /اليوم|day/i.test(c[0] ?? '')) return // header row
    const day = dayFromText(c[0])
    if (!day) {
      errors.push(`الصف ${row}: اليوم «${clean(c[0])}» غير معروف`)
      return
    }
    if (seen.has(day)) {
      errors.push(`الصف ${row}: ${DAY_BY_ID[day].name} مكرر (سبق في الصف ${seen.get(day)})`)
      return
    }
    seen.set(day, row)
    draft[day] = { mainMeal: clean(c[1]), optionalItem: clean(c[2]), optionalItem2: clean(c[3]), optionalItem3: clean(c[4]) }
    if (!draft[day].mainMeal) errors.push(`الصف ${row}: لا توجد وجبة أساسية لـ${DAY_BY_ID[day].name} — أضفها في الملف ثم أعد الاستيراد`)
  })
  if (!seen.size) errors.push('لم يتم العثور على أي يوم في الملف')
  return { draft, errors, days: [...seen.keys()] }
}

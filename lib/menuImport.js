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

/**
 * The save rule (PUT /api/menu, the import and its preview): a day may have no meals at all (e.g. Friday,
 * Saturday), but optional meals need a main meal on the same day. true = this day cannot be saved.
 */
export const optionalsWithoutMain = (d = {}) =>
  !clean(d.mainMeal) && [d.optionalItem, d.optionalItem2, d.optionalItem3].some((x) => clean(x))

export const dayFromText = (t) => DAY_ALIASES[norm(t)] ?? DAY_ALIASES[norm(t).replace(/^ال/, '')]

/**
 * Parses the weekly-menu sheet. `rows` are arrays of cell text, each with `rowNumber` (the real Excel row);
 * falls back to position + 1. Returns { draft, errors, days }. Errors block saving: an unknown day,
 * optional meals without a main meal, a day listed twice, or no days at all. A day row left completely
 * empty means "no meals that day" (like Friday/Saturday in the downloaded template), so the template
 * re-imports unchanged. Days not in the file keep their current menu. Title rows above the header
 * (the row whose first cell is «اليوم») are ignored.
 */
export function parseMenuSheet(rows, current = {}) {
  const draft = Object.fromEntries(WEEK_DAYS.map((d) => [d.id, { ...(current[d.id] || {}) }]))
  const errors = []
  const seen = new Map()
  const isHeader = (c) => /^(اليوم|day)$/i.test(clean(c?.[0]))
  const headerAt = rows.slice(0, 6).findIndex(isHeader)
  rows.forEach((c, idx) => {
    const row = c.rowNumber || idx + 1
    if (idx <= headerAt) return // header row and any title rows above it
    if (!c.some((x) => clean(x))) return
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
    if (optionalsWithoutMain(draft[day]))
      errors.push(`الصف ${row}: وجبات اختيارية بدون وجبة أساسية لـ${DAY_BY_ID[day].name} — أضف الوجبة الأساسية أو احذف الاختيارية`)
  })
  if (!seen.size) errors.push('لم يتم العثور على أي يوم في الملف')
  return { draft, errors, days: [...seen.keys()] }
}

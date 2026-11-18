// Parses order rows from Excel (an uploaded .xlsx, or cells pasted as TSV/CSV) into order payloads.
// Departments come from the DB: names, names without the "قسم " prefix, and ids are recognised.
import { roomBelongs } from './departments'
import { noMainMealError, slotKey } from './orderRules'

export const DAY_MAP = {
  الأحد: 'sun', الاحد: 'sun', sun: 'sun',
  الاثنين: 'mon', الإثنين: 'mon', mon: 'mon',
  الثلاثاء: 'tue', tue: 'tue',
  الأربعاء: 'wed', الاربعاء: 'wed', wed: 'wed',
  الخميس: 'thu', thu: 'thu',
  الجمعة: 'fri', fri: 'fri',
  السبت: 'sat', sat: 'sat',
}

export const MEAL_MAP = { فطور: 'breakfast', breakfast: 'breakfast', غداء: 'lunch', lunch: 'lunch', عشاء: 'dinner', dinner: 'dinner' }

export const PERSON_MAP = { مريض: 'patient', patient: 'patient', مرافق: 'companion', companion: 'companion' }

export function buildDeptMap(departments) {
  const map = {}
  for (const d of departments) {
    map[d.id] = d.id
    map[d.name.trim()] = d.id
    const short = d.name.trim().replace(/^قسم\s+/, '')
    if (short) map[short] = d.id
  }
  return map
}

function parseRow(cells, deptMap, deptById, row, menu) {
  const [name, dept, room, bed, person, day, meal, mainMeal, optional, notes] = cells.map((c) =>
    String(c ?? '').replace(/^"|"$/g, '').trim(),
  )
  const department = deptMap[dept] || deptMap[dept?.toLowerCase?.()]
  const dayId = DAY_MAP[day] || DAY_MAP[day?.toLowerCase?.()]
  const mealTime = MEAL_MAP[meal] || MEAL_MAP[meal?.toLowerCase?.()]
  const personType = PERSON_MAP[person] || PERSON_MAP[person?.toLowerCase?.()] || 'patient'
  // The order form labels beds A-D; the template uses 1-4. Accept both.
  const bedNum = /^[a-d]$/i.test(bed) ? 'ABCD'.indexOf(bed.toUpperCase()) + 1 : parseInt(bed)
  const errors = []
  if (!name) errors.push('الاسم مطلوب')
  if (!department) errors.push(`قسم غير معروف: "${dept}"`)
  if (!room) errors.push('رقم الغرفة مطلوب')
  else if (department && !roomBelongs(deptById[department], room)) errors.push(`الغرفة ${room} لا تتبع ${deptById[department].name}`)
  if (!bed || isNaN(bedNum) || bedNum < 1 || bedNum > 4) errors.push('رقم السرير يجب أن يكون 1-4')
  if (!dayId) errors.push(`يوم غير معروف: "${day}"`)
  if (!mealTime) errors.push(`وقت غير معروف: "${meal}"`)
  if (!mainMeal) errors.push('الوجبة الأساسية مطلوبة')
  // Same rule as the import itself (/api/bulk-orders): no orders for a day without a main meal.
  const noMain = dayId && menu ? noMainMealError(menu, dayId) : null
  if (noMain) errors.push(noMain)
  return {
    row,
    patientName: name,
    department,
    room,
    bed: bedNum,
    personType,
    day: dayId,
    mealTime,
    mainMeal,
    options: optional ? [optional] : [],
    notes: notes || '',
    errors,
    valid: errors.length === 0,
  }
}

/**
 * rows: arrays of cell strings; the first row is the header and is skipped.
 * `row` on each result is the real Excel row number (`cells.rowNumber` from readXlsxRows, which counts
 * skipped blank rows), else the position in the sheet. Errors quote it so staff find the right line.
 * menu (from GET /api/menu): when given, rows for a day without a main meal are invalid, as on import.
 */
export function parseRows(rows, departments, menu = null) {
  if (rows.length < 2) return []
  const deptMap = buildDeptMap(departments)
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]))
  return markFileDuplicates(
    rows
      .slice(1)
      .map((cells, i) => parseRow(cells, deptMap, deptById, cells.rowNumber || i + 2, menu))
      .filter((r) => r.patientName || r.department || r.room),
  )
}

/**
 * Same duplicate rule as the import (orders_unique_slot): a second row for the same department, room, bed,
 * person type, day and meal time is rejected even under another name, so the preview marks it now instead
 * of calling it «صالح». Only the first such row stays valid.
 */
function markFileDuplicates(list) {
  const seen = new Map()
  for (const r of list) {
    const key = slotKey(r)
    if (!key) continue
    const first = seen.get(key)
    if (!first) {
      if (r.valid) seen.set(key, r)
      continue
    }
    r.errors.push(`مكرر: نفس الغرفة والسرير والوجبة في الصف ${first.row}${first.patientName && first.patientName !== r.patientName ? ` (باسم ${first.patientName})` : ''}`)
    r.valid = false
  }
  return list
}

export function parseImport(text, departments, menu = null) {
  // Keep each pasted line's own number (blank lines included) as its row number.
  const lines = text
    .replace(/\s+$/, '')
    .split('\n')
    .map((l, i) => ({ l: l.replace(/\r$/, ''), n: i + 1 }))
    .filter(({ l }) => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].l.includes('\t') ? '\t' : ','
  return parseRows(
    lines.map(({ l, n }) => Object.assign(l.split(sep), { rowNumber: n })),
    departments,
    menu,
  )
}

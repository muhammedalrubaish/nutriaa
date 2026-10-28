// Parses rows pasted from Excel (TSV or CSV) into order payloads.
// Departments come from the DB: names, names without the "قسم " prefix, and ids are recognised.
import { roomBelongs } from './departments'

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

function parseRow(cells, deptMap, deptById) {
  const [name, dept, room, bed, person, day, meal, mainMeal, optional, notes] = cells.map((c) =>
    String(c ?? '').replace(/^"|"$/g, '').trim(),
  )
  const department = deptMap[dept] || deptMap[dept?.toLowerCase?.()]
  const dayId = DAY_MAP[day] || DAY_MAP[day?.toLowerCase?.()]
  const mealTime = MEAL_MAP[meal] || MEAL_MAP[meal?.toLowerCase?.()]
  const personType = PERSON_MAP[person] || PERSON_MAP[person?.toLowerCase?.()] || 'patient'
  const bedNum = parseInt(bed)
  const errors = []
  if (!name) errors.push('الاسم مطلوب')
  if (!department) errors.push(`قسم غير معروف: "${dept}"`)
  if (!room) errors.push('رقم الغرفة مطلوب')
  else if (department && !roomBelongs(deptById[department], room)) errors.push(`الغرفة ${room} لا تتبع ${deptById[department].name}`)
  if (!bed || isNaN(bedNum) || bedNum < 1 || bedNum > 4) errors.push('رقم السرير يجب أن يكون 1-4')
  if (!dayId) errors.push(`يوم غير معروف: "${day}"`)
  if (!mealTime) errors.push(`وقت غير معروف: "${meal}"`)
  if (!mainMeal) errors.push('الوجبة الأساسية مطلوبة')
  return {
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

export function parseImport(text, departments) {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const deptMap = buildDeptMap(departments)
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]))
  return lines
    .slice(1)
    .map((l) => parseRow(l.split(sep), deptMap, deptById))
    .filter((r) => r.patientName || r.department || r.room)
}

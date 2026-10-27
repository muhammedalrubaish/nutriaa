// Server-only data helpers shared by several API routes.
import { query } from './db'
import { newId, str } from './api'
import { rowToDept, roomBelongs } from './departments'
import { DAY_BY_ID, MEAL_TIME_BY_ID, MEAL_TYPES } from './constants'

export async function listDepartments({ all = false } = {}) {
  const rows = await query(
    `select * from departments ${all ? '' : 'where active'} order by sort_order, created_at, id`,
  )
  return rows.map(rowToDept)
}

export async function getMinDaily() {
  try {
    const rows = await query(`select value from settings where key = 'min_daily'`)
    const n = Number(rows[0]?.value)
    return Number.isFinite(n) && n > 0 ? n : 5
  } catch {
    return 5
  }
}

export function rowToOrder(r) {
  return {
    id: r.id,
    department: r.department,
    room: r.room,
    bed: Number(r.bed),
    patientName: r.patient_name,
    personType: r.person_type,
    day: r.day,
    mealTime: r.meal_time,
    mainMeal: r.main_meal,
    mealType: r.meal_type,
    options: Array.isArray(r.options) ? r.options : [],
    notes: r.notes,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: new Date(r.created_at).toISOString(),
  }
}

/**
 * Validates an order payload against the department list (by id).
 * Returns { error } or { value } with normalised fields.
 */
export function validateOrder(input = {}, deptById = {}) {
  const dept = deptById[input.department]
  if (!dept || !dept.active) return { error: 'القسم غير معروف أو غير مفعّل' }
  const room = str(input.room, 10)
  if (!room) return { error: 'رقم الغرفة مطلوب' }
  if (!roomBelongs(dept, room)) return { error: `الغرفة ${room} لا تتبع ${dept.name}` }
  const bed = Number(input.bed)
  if (!Number.isInteger(bed) || bed < 1 || bed > 4) return { error: 'رقم السرير يجب أن يكون 1-4' }
  const patientName = str(input.patientName, 120)
  if (!patientName) return { error: 'الرجاء كتابة الاسم' }
  const personType = input.personType === 'companion' ? 'companion' : input.personType === 'patient' || !input.personType ? 'patient' : null
  if (!personType) return { error: 'نوع الشخص غير صالح' }
  if (!DAY_BY_ID[input.day]) return { error: 'الرجاء اختيار اليوم' }
  if (!MEAL_TIME_BY_ID[input.mealTime]) return { error: 'وقت الوجبة غير صالح' }
  const mainMeal = str(input.mainMeal, 200)
  if (!mainMeal) return { error: 'الرجاء اختيار الوجبة' }
  const mealType = MEAL_TYPES.includes(input.mealType) ? input.mealType : 'main'
  const options = Array.isArray(input.options) ? input.options.map((o) => str(o, 100)).filter(Boolean).slice(0, 10) : []
  return {
    value: {
      department: dept.id,
      room: String(Number(room)),
      bed,
      patientName,
      personType,
      day: input.day,
      mealTime: input.mealTime,
      mainMeal,
      mealType,
      options,
      notes: str(input.notes, 500),
    },
  }
}

export async function insertOrder(v, user) {
  const rows = await query(
    `insert into orders (id, department, room, bed, patient_name, person_type, day, meal_time,
       main_meal, meal_type, options, notes, created_by, created_by_name)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14) returning *`,
    [
      newId('o_'), v.department, v.room, v.bed, v.patientName, v.personType, v.day, v.mealTime,
      v.mainMeal, v.mealType, JSON.stringify(v.options), v.notes, user.username, user.name,
    ],
  )
  return rowToOrder(rows[0])
}

export async function deptMap({ all = true } = {}) {
  return Object.fromEntries((await listDepartments({ all })).map((d) => [d.id, d]))
}

export async function todayCountsByDepartment(today) {
  const rows = await query(
    `select department, count(*)::int as n from orders
     where created_at >= ($1::timestamp at time zone 'Asia/Riyadh')
       and created_at <  (($1::date + 1)::timestamp at time zone 'Asia/Riyadh')
     group by department`,
    [today],
  )
  return Object.fromEntries(rows.map((r) => [r.department, r.n]))
}

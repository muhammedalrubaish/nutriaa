// Server-only data helpers shared by several API routes.
import { query } from './db'
import { newId, str } from './api'
import { rowToDept, roomBelongs } from './departments'
import { DAY_BY_ID, MEAL_TIME_BY_ID, MEAL_TYPES, WEEK_DAYS, bedLabel, personTypeName } from './constants'
import { sendToAll } from './push'
import { PERMS, rolesWith } from './roles'
import { riyadhDate } from './time'

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

/**
 * Phone push about new orders, for the staff who review them (never the sender's own devices).
 * Every order push shares one tag and does not re-alert, so a busy morning collapses into a single
 * notification on the phone that keeps updating with the day's running total, instead of one buzz per order.
 */
export async function notifyNewOrders(user, { order = null, imported = 0, deptName = '' } = {}) {
  try {
    const rows = await query(
      `select count(*)::int as n from orders where created_at >= ($1::timestamp at time zone 'Asia/Riyadh')`,
      [riyadhDate()],
    )
    const total = rows[0]?.n || 0
    const payload = order
      ? {
          title: `طلب جديد — ${deptName || order.department}`,
          body: `غرفة ${order.room} · سرير ${bedLabel(order.bed)} · ${personTypeName(order.personType)} · ${
            MEAL_TIME_BY_ID[order.mealTime]?.name || order.mealTime
          }\nبواسطة ${user.name} — طلبات اليوم: ${total}`,
        }
      : { title: `تم استيراد ${imported} طلب`, body: `بواسطة ${user.name} — طلبات اليوم: ${total}` }
    await sendToAll({ ...payload, url: '/list', tag: 'nutri-order', renotify: false }, {
      roles: rolesWith(PERMS.VIEW_REPORTS),
      excludeUserId: user.id,
    })
  } catch (e) {
    // A failed push must never fail the order itself.
    console.error('[orders] push failed', e.message)
  }
}

/**
 * Everyone who can appear as an order's author, for the user filters: current accounts plus the
 * authors of old orders whose account was since deleted. Shown by name only; `username` is just the filter key.
 */
export async function listOrderUsers() {
  return query(
    `select username, name from users
     union all
     select o.created_by, max(o.created_by_name) from orders o
     where not exists (select 1 from users u where u.username = o.created_by)
     group by o.created_by
     order by 2, 1`,
  )
}

// Recent menu edits live in `settings` (key 'menu_changes', newest first) so no schema change is needed.
const MENU_CHANGES_KEY = 'menu_changes'
const MENU_CHANGES_KEEP = 20
// How long a menu change stays in the bell.
const MENU_CHANGE_DAYS = 7

/** Days whose main meal or optional item differ between two menus from readMenu(). */
export function diffMenu(before = {}, after = {}) {
  return WEEK_DAYS.filter((d) => {
    const a = before[d.id] || {}
    const b = after[d.id] || {}
    return (a.mainMeal || '') !== (b.mainMeal || '') || (a.optionalItem || '') !== (b.optionalItem || '')
  }).map((d) => ({ day: d.id, mainMeal: after[d.id]?.mainMeal || '', optionalItem: after[d.id]?.optionalItem || '' }))
}

const menuDayLine = (c) =>
  `${DAY_BY_ID[c.day]?.name || c.day}: ${c.mainMeal || '—'}${c.optionalItem ? ` / ${c.optionalItem}` : ''}`

/**
 * Logs a menu edit for the bell and pushes it to the staff who enter orders (not the editor's own devices).
 * Never throws: a failed alert must not fail the menu save.
 */
export async function notifyMenuChange(user, days) {
  if (!days.length) return null
  const change = { id: newId('m_'), days, createdBy: user.username, createdByName: user.name, createdAt: new Date().toISOString() }
  try {
    await query(
      `insert into settings (key, value) values ($1, $2::jsonb)
       on conflict (key) do update
         set value = jsonb_path_query_array($2::jsonb || settings.value, '$[0 to ${MENU_CHANGES_KEEP - 1}]')`,
      [MENU_CHANGES_KEY, JSON.stringify([change])],
    )
  } catch (e) {
    console.error('[menu] change log failed', e.message)
  }
  try {
    await sendToAll(
      {
        title: 'تم تعديل قائمة الوجبات',
        body: `${days.map(menuDayLine).join('\n')}\nبواسطة ${user.name}`,
        url: '/menu',
        tag: 'nutri-menu',
      },
      { roles: rolesWith(PERMS.CREATE_ORDERS), excludeUserId: user.id },
    )
  } catch (e) {
    console.error('[menu] push failed', e.message)
  }
  return change
}

/** Menu edits from the last week, newest first. */
export async function recentMenuChanges(now = Date.now()) {
  try {
    const rows = await query(`select value from settings where key = $1`, [MENU_CHANGES_KEY])
    const list = Array.isArray(rows[0]?.value) ? rows[0].value : []
    const since = now - MENU_CHANGE_DAYS * 24 * 60 * 60 * 1000
    return list.filter((c) => c?.id && Array.isArray(c.days) && new Date(c.createdAt).getTime() >= since)
  } catch {
    return []
  }
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

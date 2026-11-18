// Order rules shared by the server (POST /api/orders, /api/bulk-orders) and the client (import preview),
// so the preview never calls a row «صالح» that the import then rejects. No server-only imports here.
import { DAY_BY_ID } from './constants'

/** No orders for a day without a main meal in the weekly menu (e.g. Friday). Returns the error or null. */
export function noMainMealError(menu, day) {
  if (!day || !menu || menu[day]?.mainMeal) return null
  return `لا توجد وجبة أساسية ليوم ${DAY_BY_ID[day]?.name || day} في القائمة — لا يمكن إدخال طلب له`
}

/**
 * The meal slot an order occupies (Abdullah, 2026-11-18): one order per department, room, bed, person type,
 * meal time and meal date — whatever the name. Two orders for the same bed and meal under different names
 * are still a duplicate. Same key as the partial unique index orders_unique_bed_slot (db/migrations/008), minus
 * meal_date, which is the same for every row of one import (all entered today), so `day` stands in for it.
 */
export const SLOT_FIELDS = ['department', 'room', 'bed', 'personType', 'mealTime']

/** Slot key of an order payload for the same entry date; null while a key field is missing. */
export function slotKey(o) {
  if (!o || !o.day || SLOT_FIELDS.some((k) => o[k] === undefined || o[k] === null || o[k] === '' || Number.isNaN(o[k]))) return null
  return [o.department, String(o.room).trim(), Number(o.bed), o.personType, o.mealTime, o.day].join('|')
}

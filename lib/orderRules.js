// Order rules shared by the server (POST /api/orders, /api/bulk-orders) and the client (import preview),
// so the preview never calls a row «صالح» that the import then rejects. No server-only imports here.
import { DAY_BY_ID } from './constants'

/** No orders for a day without a main meal in the weekly menu (e.g. Friday). Returns the error or null. */
export function noMainMealError(menu, day) {
  if (!day || !menu || menu[day]?.mainMeal) return null
  return `لا توجد وجبة أساسية ليوم ${DAY_BY_ID[day]?.name || day} في القائمة — لا يمكن إدخال طلب له`
}

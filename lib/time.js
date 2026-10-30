// "Today" and day boundaries are computed in Asia/Riyadh (UTC+3, no DST),
// not in UTC as production did.
export const TZ = 'Asia/Riyadh'

const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** YYYY-MM-DD of the given instant in Riyadh. */
export function riyadhDate(date = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

export function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Whole days from a to b (both YYYY-MM-DD). */
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}

/** First day (Sunday) of the week containing ymd. */
export function weekStart(ymd) {
  return addDays(ymd, -new Date(ymd + 'T00:00:00Z').getUTCDay())
}

export function monthStart(ymd) {
  return ymd.slice(0, 8) + '01'
}

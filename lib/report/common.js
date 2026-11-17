// Shared lookups for the printable sheets (cards, reports), built on the app's own constants.
import { DAY_BY_ID, MEAL_TIME_BY_ID, PERSON_CARD_LABEL, WEEK_DAYS, MEAL_TIMES, personTypeName } from '../constants'

export { APP_SUBTITLE, APP_TITLE, COPYRIGHT, bedLabel } from '../constants'
export { roleName } from '../roles'

export const DAYS = WEEK_DAYS
export { MEAL_TIMES }
export const DAY_NAME = Object.fromEntries(WEEK_DAYS.map((d) => [d.id, d.name]))
export const MEAL_TIME_NAME = Object.fromEntries(MEAL_TIMES.map((m) => [m.id, m.name]))
export const MEAL_TYPE_NAME = { main: 'الوجبة الأساسية', optional: 'الوجبة الاختيارية', custom: 'وجبة مخصصة' }
export const personName = personTypeName
/** Note 2: the person type printed on a card. */
export const personCardLabel = (p) => PERSON_CARD_LABEL[p] || String(p || '').toUpperCase()

const DEPT_HEX = {
  violet: '#7c3aed', sky: '#0284c7', emerald: '#059669', rose: '#e11d48', amber: '#d97706', indigo: '#4f46e5',
  teal: '#0d9488', orange: '#ea580c', pink: '#db2777', cyan: '#0891b2', lime: '#65a30d', fuchsia: '#c026d3',
}
export const deptHex = (c) => DEPT_HEX[c] || '#0284c7'

export const LOGO_SRC = '/qhc-logo.jpeg'

const dtFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})
export const fmtDateTime = (iso) => dtFmt.format(new Date(iso))
export const hourOf = (iso) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(new Date(iso))) % 24

/** Compact "MM-DD HH:mm" (24h, Riyadh) for dense report tables. */
const compactFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})
export function fmtCompact(iso) {
  const p = Object.fromEntries(compactFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

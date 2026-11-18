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

/**
 * Shortens text in code (logical order, «…» at the logical end) instead of CSS text-overflow.
 * html2canvas (PDF) mis-renders CSS ellipsis/clipping in RTL text, so sheets never rely on it.
 */
export function clip(v, max) {
  const chars = Array.from(String(v ?? '').replace(/\s+/g, ' ').trim())
  if (chars.length <= max) return chars.join('')
  let cut = chars.slice(0, Math.max(1, max - 1)).join('')
  // Prefer ending on a whole word when one ends close to the limit.
  const sp = cut.lastIndexOf(' ')
  if (chars[max - 1] !== ' ' && sp > 0 && cut.length - sp <= 8) cut = cut.slice(0, sp)
  return cut.trimEnd() + '…'
}

/**
 * Escapes text for the sheets and isolates Latin/digit runs (e.g. «ناديه(m)», «RICE MEAT») in an LTR span.
 * The PDF renderer (html2canvas) draws brackets inside RTL text unmirrored — «ناديه )m(» — while the
 * browser mirrors them; an isolated LTR run looks the same in print, on screen and in the PDF.
 */
const LTR_RUN = /\(?[A-Za-z0-9](?:[A-Za-z0-9 .,+\-\/&:_'#()]*[A-Za-z0-9)])?/g
export function bidiHtml(v) {
  const s = String(v ?? '')
  if (!/[\u0600-\u06ff]/.test(s) || !/[A-Za-z0-9]/.test(s)) return esc(s)
  let out = ''
  let last = 0
  for (const m of s.matchAll(LTR_RUN)) {
    out += esc(s.slice(last, m.index)) + `<span dir="ltr" style="unicode-bidi:isolate">${esc(m[0])}</span>`
    last = m.index + m[0].length
  }
  return out + esc(s.slice(last))
}

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

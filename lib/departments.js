// Department helpers shared by the client and the server (no DB access here).

export const DEPT_COLORS = [
  'violet', 'sky', 'emerald', 'rose', 'amber', 'indigo', 'teal', 'orange', 'pink', 'cyan', 'lime', 'fuchsia',
]

export const COLOR_NAMES = {
  violet: 'بنفسجي', sky: 'سماوي', emerald: 'زمردي', rose: 'وردي', amber: 'كهرماني', indigo: 'نيلي',
  teal: 'فيروزي', orange: 'برتقالي', pink: 'زهري', cyan: 'سيان', lime: 'ليموني', fuchsia: 'فوشي',
}

// Literal class strings so Tailwind keeps them (department colours are data-driven).
export const COLOR_CLASSES = {
  violet: { ring: 'ring-violet-500/30', dot: 'bg-violet-500', text: 'text-violet-500', bar: 'bg-violet-500', soft: 'bg-violet-500/15' },
  sky: { ring: 'ring-sky-500/30', dot: 'bg-sky-500', text: 'text-sky-500', bar: 'bg-sky-500', soft: 'bg-sky-500/15' },
  emerald: { ring: 'ring-emerald-500/30', dot: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-emerald-500', soft: 'bg-emerald-500/15' },
  rose: { ring: 'ring-rose-500/30', dot: 'bg-rose-500', text: 'text-rose-500', bar: 'bg-rose-500', soft: 'bg-rose-500/15' },
  amber: { ring: 'ring-amber-500/30', dot: 'bg-amber-500', text: 'text-amber-500', bar: 'bg-amber-500', soft: 'bg-amber-500/15' },
  indigo: { ring: 'ring-indigo-500/30', dot: 'bg-indigo-500', text: 'text-indigo-500', bar: 'bg-indigo-500', soft: 'bg-indigo-500/15' },
  teal: { ring: 'ring-teal-500/30', dot: 'bg-teal-500', text: 'text-teal-500', bar: 'bg-teal-500', soft: 'bg-teal-500/15' },
  orange: { ring: 'ring-orange-500/30', dot: 'bg-orange-500', text: 'text-orange-500', bar: 'bg-orange-500', soft: 'bg-orange-500/15' },
  pink: { ring: 'ring-pink-500/30', dot: 'bg-pink-500', text: 'text-pink-500', bar: 'bg-pink-500', soft: 'bg-pink-500/15' },
  cyan: { ring: 'ring-cyan-500/30', dot: 'bg-cyan-500', text: 'text-cyan-500', bar: 'bg-cyan-500', soft: 'bg-cyan-500/15' },
  lime: { ring: 'ring-lime-500/30', dot: 'bg-lime-500', text: 'text-lime-500', bar: 'bg-lime-500', soft: 'bg-lime-500/15' },
  fuchsia: { ring: 'ring-fuchsia-500/30', dot: 'bg-fuchsia-500', text: 'text-fuchsia-500', bar: 'bg-fuchsia-500', soft: 'bg-fuchsia-500/15' },
}

export const colorClasses = (c) => COLOR_CLASSES[c] || COLOR_CLASSES.emerald

export function range(a, b) {
  const r = []
  for (let i = a; i <= b; i++) r.push(i)
  return r
}

/** All room numbers of a department: roomFrom..roomTo plus extraRooms, sorted and unique. */
export function roomsOf(d) {
  if (!d) return []
  const set = new Set([...range(Number(d.roomFrom), Number(d.roomTo)), ...(d.extraRooms || []).map(Number)])
  return [...set].filter((n) => Number.isInteger(n)).sort((a, b) => a - b)
}

export function roomBelongs(d, room) {
  const n = Number(String(room ?? '').trim())
  return Number.isInteger(n) && roomsOf(d).includes(n)
}

export function rowToDept(r) {
  const d = {
    id: r.id,
    name: r.name,
    color: r.color,
    roomFrom: Number(r.room_from),
    roomTo: Number(r.room_to),
    extraRooms: (r.extra_rooms || []).map(Number),
    sortOrder: Number(r.sort_order),
    active: !!r.active,
  }
  d.rooms = roomsOf(d)
  return d
}

/** Parses "201, 205-207" or [201, 205] into a sorted list of unique integers; null when invalid. */
export function parseRoomList(input) {
  if (input == null || input === '') return []
  const parts = Array.isArray(input) ? input.map(String) : String(input).split(/[,،\s]+/)
  const out = new Set()
  for (const raw of parts) {
    const p = raw.trim()
    if (!p) continue
    const m = p.match(/^(\d{1,4})(?:-(\d{1,4}))?$/)
    if (!m) return null
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b > 9999 || b < a || b - a > 2000) return null
    range(a, b).forEach((n) => out.add(n))
  }
  return [...out].sort((x, y) => x - y)
}

/** Validates create/update input. Returns { errors, value }. */
export function validateDept(input = {}) {
  const errors = []
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : ''
  const color = input.color || 'emerald'
  const roomFrom = Number(input.roomFrom)
  const roomTo = Number(input.roomTo)
  const extraRooms = parseRoomList(input.extraRooms)
  if (!name) errors.push('اسم القسم مطلوب')
  if (!DEPT_COLORS.includes(color)) errors.push('لون غير صالح')
  if (!Number.isInteger(roomFrom) || !Number.isInteger(roomTo) || roomFrom < 1 || roomTo > 9999)
    errors.push('أرقام الغرف يجب أن تكون بين 1 و 9999')
  else if (roomFrom > roomTo) errors.push('رقم "من غرفة" يجب ألا يتجاوز "إلى غرفة"')
  if (extraRooms === null) errors.push('الغرف الإضافية غير صالحة (مثال: 201, 205-207)')
  return {
    errors,
    value: { name, color, roomFrom, roomTo, extraRooms: extraRooms || [], active: input.active !== false },
  }
}

/** Names of other active departments whose rooms overlap with d. */
export function findOverlaps(d, others) {
  const mine = new Set(roomsOf(d))
  return others
    .filter((o) => o.id !== d.id && o.active !== false && roomsOf(o).some((n) => mine.has(n)))
    .map((o) => o.name)
}

/** "غرف 126–148 (23 غرفة)" style summary. */
export function roomsSummary(d) {
  const extra = d.extraRooms?.length ? ` + ${d.extraRooms.join('، ')}` : ''
  return `غرف ${d.roomFrom}–${d.roomTo}${extra} (${roomsOf(d).length} غرفة)`
}

// Phones: at most this many slots in the bottom bar; the rest go into the «المزيد» sheet.
export const MAX_BOTTOM = 5

/** Splits nav items into the bottom-bar tabs and the «المزيد» sheet (4 tabs + «المزيد» when more than 5). */
export function splitNav(items, max = MAX_BOTTOM) {
  if (items.length <= max) return { shown: items, more: [] }
  return { shown: items.slice(0, max - 1), more: items.slice(max - 1) }
}

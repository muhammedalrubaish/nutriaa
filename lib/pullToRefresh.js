// Pull-to-refresh: pure logic (thresholds, labels, start guards). The DOM side is components/PullToRefresh.js.

export const PULL_THRESHOLD = 70 // indicator distance (px) that arms the refresh
export const PULL_MAX = 120
export const RESISTANCE = 0.55 // finger px -> indicator px

export const LABELS = {
  pull: 'اسحب للتحديث',
  release: 'أفلت للتحديث',
  refreshing: 'جارٍ التحديث...',
}

/** Indicator distance for a finger drag of `dy` px (negative/zero → 0, capped at PULL_MAX). */
export function pullDistance(dy) {
  if (!Number.isFinite(dy) || dy <= 0) return 0
  return Math.min(PULL_MAX, Math.round(dy * RESISTANCE))
}

/** 'idle' | 'pull' | 'release' for an indicator distance. */
export function pullPhase(distance, threshold = PULL_THRESHOLD) {
  if (!distance || distance <= 0) return 'idle'
  return distance >= threshold ? 'release' : 'pull'
}

export function labelFor(phase) {
  return LABELS[phase] || LABELS.pull
}

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Whether a touch may begin a pull. */
export function canStartPull({
  touches = 1,
  scrollY = 0,
  modalOpen = false,
  activeTag = '',
  activeEditable = false,
  innerScrolled = false,
  refreshing = false,
} = {}) {
  if (refreshing || touches !== 1) return false
  if (scrollY > 0) return false
  if (modalOpen || innerScrolled || activeEditable) return false
  if (activeTag && EDITABLE.has(String(activeTag).toUpperCase())) return false
  return true
}

/**
 * Once moving: decide whether this gesture is a pull. Mostly-horizontal or upward drags are not;
 * returns 'pull' | 'cancel' | 'wait' (not enough movement yet).
 */
export function classifyMove(dx, dy, slop = 6) {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return 'wait'
  if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) return 'cancel'
  return 'pull'
}

/** Release outcome: refresh only when armed. */
export function shouldRefresh(distance, threshold = PULL_THRESHOLD) {
  return pullPhase(distance, threshold) === 'release'
}

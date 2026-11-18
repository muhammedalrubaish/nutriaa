// Auto-update: pure helpers for comparing the running build with the deployed one and guarding
// against reload loops. Used by lib/useAppUpdate.js; kept DOM-free so it can be unit tested.

export const RELOAD_GUARD_KEY = 'nutri:app-reload'
export const RELOAD_GUARD_MS = 30_000
export const MAX_DEFER_MS = 120_000
export const RECENT_TYPING_MS = 20_000

export function normalizeVersion(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/** True only when both versions are known and differ (unknown/empty never triggers a reload). */
export function isNewVersion(clientVersion, serverVersion) {
  const c = normalizeVersion(clientVersion)
  const s = normalizeVersion(serverVersion)
  if (!c || !s || c === 'dev' || s === 'dev') return false
  return c !== s
}

function readGuard(storage) {
  try {
    const raw = storage?.getItem(RELOAD_GUARD_KEY)
    if (!raw) return null
    const g = JSON.parse(raw)
    return g && typeof g.v === 'string' && typeof g.t === 'number' ? g : null
  } catch {
    return null
  }
}

/** Loop guard: at most one forced reload per target version per RELOAD_GUARD_MS. */
export function canReload(storage, version, now = Date.now(), windowMs = RELOAD_GUARD_MS) {
  const g = readGuard(storage)
  if (!g || g.v !== version) return true
  return now - g.t >= windowMs
}

export function markReload(storage, version, now = Date.now()) {
  try {
    storage?.setItem(RELOAD_GUARD_KEY, JSON.stringify({ v: version, t: now }))
  } catch {}
}

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Whether reloading now could lose something the user is typing. */
export function isBusy({ activeTag, activeEditable = false, lastInputAt = 0, now = Date.now() } = {}) {
  if (activeEditable) return true
  if (activeTag && EDITABLE.has(String(activeTag).toUpperCase())) return true
  return !!lastInputAt && now - lastInputAt < RECENT_TYPING_MS
}

/** Decide what to do once a new version is known. */
export function decideAction({ busy, detectedAt, now = Date.now(), maxDeferMs = MAX_DEFER_MS }) {
  if (!busy) return 'reload'
  if (detectedAt && now - detectedAt >= maxDeferMs) return 'reload'
  return 'defer'
}

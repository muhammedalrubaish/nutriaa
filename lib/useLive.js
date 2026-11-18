// Note 10: near-real-time updates. One shared poller per tab asks /api/version every few seconds while the
// tab is visible (and at once when it becomes visible again) and fires LIVE_EVENT when the data changed.
// Screens call useLive(reload) to refetch on that event.
import { useEffect, useRef } from 'react'

export const LIVE_EVENT = 'nutri:live'
const INTERVAL_MS = 5000

let started = false
let last = null

function startPoller() {
  if (started || typeof window === 'undefined') return
  started = true
  const tick = async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const r = await fetch('/api/version', { cache: 'no-store' })
      if (!r.ok) return
      const { v } = await r.json()
      if (last !== null && v !== last) window.dispatchEvent(new Event(LIVE_EVENT))
      last = v
    } catch {}
  }
  tick()
  setInterval(tick, INTERVAL_MS)
  document.addEventListener('visibilitychange', tick)
}

/** Calls `onChange` whenever the shared data changes (orders, notes, menu, departments). */
export function useLive(onChange, enabled = true) {
  const ref = useRef(onChange)
  ref.current = onChange
  useEffect(() => {
    if (!enabled) return
    startPoller()
    const h = () => ref.current?.()
    window.addEventListener(LIVE_EVENT, h)
    return () => window.removeEventListener(LIVE_EVENT, h)
  }, [enabled])
}

// Pull-to-refresh for touch screens (the iOS home-screen app has no reload button). Drag down from the
// top of the page past the threshold and release → full reload. Ignores mouse, open modals, fields being
// typed in and touches inside an inner scroller that is not at its top. Hidden in print.
import { useEffect, useRef, useState } from 'react'
import { pullDistance, pullPhase, labelFor, canStartPull, classifyMove, shouldRefresh, PULL_THRESHOLD } from '@/lib/pullToRefresh'

const MODAL_SELECTOR = '[role="dialog"], [aria-modal="true"], .fixed.inset-0'

function innerScrolled(target) {
  for (let el = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (!(el instanceof Element)) continue
    const oy = getComputedStyle(el).overflowY
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) return true
  }
  return false
}

export default function PullToRefresh() {
  const [dist, setDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const g = useRef({ active: false, pulling: false, x: 0, y: 0, dist: 0, refreshing: false })

  useEffect(() => {
    const s = g.current
    const reset = () => {
      s.active = false
      s.pulling = false
      s.dist = 0
      setDist(0)
    }
    // A focused field only blocks the pull once the user typed in it (or the drag starts on it), so an
    // autofocused empty field (login) does not disable pull-to-refresh but half-typed input is safe.
    let typed = false
    const onFocusIn = () => { typed = false }
    const onInput = () => { typed = true }
    const onStart = (e) => {
      const focused = document.activeElement
      const el = focused && (typed || focused.contains(e.target)) ? focused : null
      const ok = canStartPull({
        touches: e.touches.length,
        scrollY: window.scrollY || document.documentElement.scrollTop || 0,
        modalOpen: !!document.querySelector(MODAL_SELECTOR) || document.documentElement.classList.contains('print-view-open'),
        activeTag: el?.tagName,
        activeEditable: !!el?.isContentEditable,
        innerScrolled: innerScrolled(e.target),
        refreshing: s.refreshing,
      })
      if (!ok) return reset()
      s.active = true
      s.pulling = false
      s.x = e.touches[0].clientX
      s.y = e.touches[0].clientY
    }
    const onMove = (e) => {
      if (!s.active) return
      if (e.touches.length !== 1) return reset()
      const dx = e.touches[0].clientX - s.x
      const dy = e.touches[0].clientY - s.y
      if (!s.pulling) {
        const c = classifyMove(dx, dy)
        if (c === 'wait') return
        if (c === 'cancel' || window.scrollY > 0) return reset()
        s.pulling = true
      }
      if (e.cancelable) e.preventDefault() // only while actively pulling
      s.dist = pullDistance(dy)
      setDist(s.dist)
    }
    const onEnd = () => {
      if (!s.active) return
      const go = s.pulling && shouldRefresh(s.dist)
      if (go) {
        s.refreshing = true
        s.active = false
        setRefreshing(true)
        setDist(PULL_THRESHOLD)
        setTimeout(() => window.location.reload(), 150)
      } else reset()
    }
    // Touch events only (mouse never triggers). touchmove must be non-passive to stop the native
    // scroll while pulling; it returns immediately unless a pull is in progress.
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('input', onInput, true)
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', reset, { passive: true })
    return () => {
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('input', onInput, true)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', reset)
    }
  }, [])

  if (!dist && !refreshing) return null
  const phase = refreshing ? 'refreshing' : pullPhase(dist)
  const progress = Math.min(1, dist / PULL_THRESHOLD)
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="print:hidden fixed inset-x-0 top-0 z-[1100] flex justify-center pointer-events-none"
      style={{ transform: `translateY(${Math.max(0, dist - 44)}px)`, transition: dist && !refreshing ? 'none' : 'transform .2s' }}
    >
      <div className="mt-2 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#0b2655] text-white text-sm font-semibold px-4 py-2 shadow-lg">
        {refreshing ? (
          <span className="inline-block h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        ) : (
          <span
            className="inline-block text-emerald-400 transition-transform"
            style={{ transform: `rotate(${phase === 'release' ? 180 : 0}deg)`, opacity: 0.4 + 0.6 * progress }}
          >
            ↓
          </span>
        )}
        <span>{labelFor(phase)}</span>
      </div>
    </div>
  )
}

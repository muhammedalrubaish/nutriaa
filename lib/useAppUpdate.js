// Forced auto-update: when a new deploy goes live, every open tab (Safari, home-screen PWA) reloads
// itself. Checks on load, every 60s, when the tab becomes visible, on focus and on bfcache restore.
// If the user is typing, a small banner shows and the reload waits for the field to lose focus
// (max 2 minutes). A client-side route change after a new deploy becomes a full page load.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { isNewVersion, canReload, markReload, isBusy, decideAction } from './appUpdate'

export const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || ''
const CHECK_EVERY_MS = 60_000

export function useAppUpdate() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !CLIENT_VERSION) return
    let target = null // server version once a mismatch is seen
    let detectedAt = 0
    let lastInputAt = 0
    let checking = false
    let deferTimer = null

    const store = (() => {
      try { return window.sessionStorage } catch { return null }
    })()

    const busyNow = () => {
      const el = document.activeElement
      return isBusy({ activeTag: el?.tagName, activeEditable: !!el?.isContentEditable, lastInputAt })
    }

    const reloadNow = () => {
      if (!target || !canReload(store, target)) return false
      markReload(store, target)
      window.location.reload()
      return true
    }

    const tryApply = () => {
      if (!target) return
      const action = decideAction({ busy: busyNow(), detectedAt })
      if (action === 'reload') {
        if (!reloadNow()) setPending(false)
        return
      }
      setPending(true)
      clearTimeout(deferTimer)
      deferTimer = setTimeout(tryApply, 5_000)
    }

    const check = async () => {
      if (checking) return
      checking = true
      try {
        navigator.serviceWorker?.getRegistration?.().then((r) => r?.update()).catch(() => {})
        const r = await fetch('/api/app-version', { cache: 'no-store' })
        if (!r.ok) return
        const { version } = await r.json()
        if (isNewVersion(CLIENT_VERSION, version)) {
          if (target !== version) { target = version; detectedAt = Date.now() }
          tryApply()
        }
      } catch {
      } finally {
        checking = false
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    const onInput = () => { lastInputAt = Date.now() }
    const onBlur = () => { if (target) setTimeout(tryApply, 300) }
    const onSubmit = () => { lastInputAt = 0 }
    const onRoute = (url) => {
      // New deploy detected: turn the client-side navigation into a full load of the new build.
      if (target && canReload(store, target)) {
        markReload(store, target)
        window.location.assign(url)
      }
    }

    check()
    const iv = setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('input', onInput, true)
    document.addEventListener('focusout', onBlur, true)
    document.addEventListener('submit', onSubmit, true)
    router.events.on('routeChangeStart', onRoute)
    return () => {
      clearInterval(iv)
      clearTimeout(deferTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('focusout', onBlur, true)
      document.removeEventListener('submit', onSubmit, true)
      router.events.off('routeChangeStart', onRoute)
    }
  }, [router])

  return pending
}

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { COPYRIGHT } from '@/lib/constants'

// © footer, same markup and look as the Cafeteria app (cafeteria/src/components/Footer.tsx): centred © text and
// «عن النظام» on its own line. Pinned to the screen on every page (Abdullah 19 Nov «ثبت الحقوق في جميع الصفحات
// بالاسفل» / «خل الحقوق هي اخر شي»): position fixed, flush at the very bottom with the iOS safe area — it is
// the last thing on the screen. It never scrolls or moves with pull-to-refresh. On phones the tab bar is
// fixed directly above it. Measured heights are published as --footer-real / --nav-real so page content is
// padded and never hidden behind them. Screen only: print and the PDF keep their own footer.
export default function Footer() {
  const { pathname } = useRouter()
  const bar = useRef(null)
  useEffect(() => {
    const el = bar.current
    const root = document.documentElement
    if (!el) return
    let nav = null
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => set()) : null
    function set() {
      const n = document.querySelector('[data-bottom-nav]')
      if (n !== nav) {
        if (nav) ro?.unobserve(nav)
        nav = n
        if (nav) ro?.observe(nav, { box: 'border-box' })
      }
      const navH = nav && getComputedStyle(nav).display !== 'none' ? Math.ceil(nav.getBoundingClientRect().height) : 0
      root.style.setProperty('--nav-real', `${navH}px`)
      root.style.setProperty('--footer-real', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    }
    set()
    ro?.observe(el, { box: 'border-box' })
    ro?.observe(document.body)
    window.addEventListener('resize', set)
    window.addEventListener('orientationchange', set)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', set)
      window.removeEventListener('orientationchange', set)
      root.style.removeProperty('--nav-real')
      root.style.removeProperty('--footer-real')
    }
  }, [pathname])
  return (
    <footer ref={bar} data-testid="app-footer" className="app-footer print:hidden" dir="rtl">
      <span className="app-footer-text">{COPYRIGHT}</span>
      <Link href="/about" className="app-footer-link" data-testid="about-link">
        عن النظام
      </Link>
    </footer>
  )
}

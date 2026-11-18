import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { COPYRIGHT } from '@/lib/constants'

// Copyright line pinned to the bottom of the screen, like the Cafeteria app (Abdullah 19 Nov «خلها ثابته مثل
// الكافتيريا … اذا نزلت الصفحه ينزل»): position fixed, never scrolls, bounces or moves with pull-to-refresh
// (it lives outside the page content and nothing transforms its ancestors). On phones with the bottom tab nav
// it sits right on top of the nav; elsewhere at the very bottom with the iOS safe-area padding. Its measured
// height (and the nav's) is published as --footer-real / --nav-real so page content is padded and never hidden.
// Screen only: print and the PDF have their own footer.
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
      el.toggleAttribute('data-on-nav', navH > 0)
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
    }
  }, [pathname])
  return (
    <footer ref={bar} data-testid="app-footer" className="app-footer print:hidden" dir="rtl">
      <span>{COPYRIGHT}</span>
      <Link href="/about" className="app-footer-link">
        عن النظام
      </Link>
    </footer>
  )
}

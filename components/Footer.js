import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { COPYRIGHT } from '@/lib/constants'

// © footer, same markup and look as the Cafeteria app (cafeteria/src/components/Footer.tsx): centred © text and
// «عن النظام» on its own line. Login / about / desktop: fixed flush to the bottom with the iOS safe area (it never
// scrolls or moves on pull-down); its measured height is published as --footer-real and reserved as page padding.
// Phones with the bottom tab bar (Abdullah 19 Nov «فيه مشكله»): in normal flow at the end of the page, above the
// fixed tab bar (whose height is published as --nav-real), so it never covers content. Screen only.
const NO_NAV = ['/login', '/about']

export default function Footer() {
  const { pathname } = useRouter()
  const withNav = !NO_NAV.includes(pathname)
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
      if (navH) root.style.setProperty('--nav-real', `${navH}px`)
      root.classList.toggle('footer-inflow', withNav)
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
      root.classList.remove('footer-inflow')
    }
  }, [pathname, withNav])
  return (
    <footer ref={bar} data-testid="app-footer" className={`app-footer print:hidden${withNav ? ' with-nav' : ''}`} dir="rtl">
      <span className="app-footer-text">{COPYRIGHT}</span>
      <Link href="/about" className="app-footer-link" data-testid="about-link">
        عن النظام
      </Link>
    </footer>
  )
}

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Abdullah 19 Nov «ثبت الحقوق في جميع الصفحات بالاسفل»: the © line is pinned on every page, including above the tab bar.
const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')
const footer = readFileSync(new URL('../components/Footer.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../pages/_app.js', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../components/Nav.js', import.meta.url), 'utf8')

describe('fixed © footer on every page (Cafeteria look)', () => {
  it('is position fixed, centred, link on its own line, Cafeteria size, with the iOS safe area', () => {
    const rule = css.match(/\.app-footer \{[^}]*\}/)[0]
    expect(rule).toMatch(/position: fixed/)
    expect(rule).toMatch(/bottom: var\(--nav-real, 0px\)/)
    expect(rule).toMatch(/flex-direction: column/)
    expect(rule).toMatch(/env\(safe-area-inset-bottom/)
    expect(rule).toMatch(/font-size: 10\.5px/) // Cafeteria's size
  })
  it('sits directly above the phone tab bar and drops the safe-area padding (the nav already has it)', () => {
    expect(css).toMatch(/\.app-footer\[data-on-nav\] \{\s*padding-bottom: 0\.15rem;/)
    expect(footer).toMatch(/toggleAttribute\('data-on-nav'/)
    expect(footer).toMatch(/--nav-real/)
    expect(nav).toMatch(/<nav data-bottom-nav /)
    expect(css).not.toMatch(/footer-inflow/)
    expect(css).not.toMatch(/\.app-footer\.with-nav/)
    expect(footer).not.toMatch(/footer-inflow|with-nav|NO_NAV/)
  })
  it('pads the page by the measured footer + nav height, and the page itself does not rubber-band', () => {
    expect(css).toMatch(/body \{\s*padding-bottom: calc\(var\(--footer-real[^;]*\+ var\(--nav-real, 0px\)/)
    expect(css).toMatch(/html \{\s*overscroll-behavior-y: none;/)
    expect(footer).toMatch(/--footer-real/)
  })
  it('stays outside the page content (nothing transforms it) and out of print', () => {
    expect(app.indexOf('<Footer />')).toBeGreaterThan(app.indexOf('<Component {...pageProps} />'))
    expect(footer).toMatch(/className="app-footer print:hidden"/)
    expect(css).toMatch(/@media print \{\s*body \{\s*padding-bottom: 0 !important;\s*\}\s*\.app-footer \{\s*display: none !important;/)
  })
})

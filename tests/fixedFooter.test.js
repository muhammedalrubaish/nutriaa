import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Abdullah 19 Nov «ايه الحقوق خلها ثابته مثل الكافتيريا … اذا نزلت الصفحه ينزل»: the © line is pinned to the screen.
const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')
const footer = readFileSync(new URL('../components/Footer.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../pages/_app.js', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../components/Nav.js', import.meta.url), 'utf8')

describe('© footer like the Cafeteria app', () => {
  it('login / about / desktop: fixed flush to the bottom with the iOS safe area, centred, link on its own line', () => {
    const rule = css.match(/\.app-footer \{[^}]*\}/)[0]
    expect(rule).toMatch(/position: fixed/)
    expect(rule).toMatch(/bottom: 0;/)
    expect(rule).toMatch(/flex-direction: column/)
    expect(rule).toMatch(/env\(safe-area-inset-bottom/)
    expect(rule).toMatch(/font-size: 10\.5px/) // Cafeteria's size
    expect(footer).toMatch(/const NO_NAV = \['\/login', '\/about'\]/)
  })
  it('phones with the tab bar: in normal flow at the end of the page, clear of the fixed nav', () => {
    const m = css.match(/@media \(max-width: 1023\.98px\) \{([\s\S]*?)\n\}/)[1]
    expect(m).toMatch(/\.app-footer\.with-nav \{[^}]*position: static;/)
    expect(m).toMatch(/padding-bottom: calc\(var\(--nav-real/)
    expect(m).toMatch(/html\.footer-inflow body \{\s*padding-bottom: 0;/)
    expect(nav).toMatch(/<nav data-bottom-nav /)
  })
  it('pinned footer: page padded by its measured height, no page rubber-band', () => {
    expect(css).toMatch(/body \{\s*padding-bottom: calc\(var\(--footer-real/)
    expect(css).toMatch(/html \{\s*overscroll-behavior-y: none;/)
    expect(footer).toMatch(/--footer-real/)
  })
  it('stays outside the page content (nothing transforms it) and out of print', () => {
    expect(app.indexOf('<Footer />')).toBeGreaterThan(app.indexOf('<Component {...pageProps} />'))
    expect(footer).toMatch(/app-footer print:hidden/)
    expect(css).toMatch(/@media print \{\s*body \{\s*padding-bottom: 0 !important;\s*\}\s*\.app-footer \{\s*display: none !important;/)
  })
})

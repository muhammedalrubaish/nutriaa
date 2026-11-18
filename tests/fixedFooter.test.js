import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Abdullah 19 Nov «ايه الحقوق خلها ثابته مثل الكافتيريا … اذا نزلت الصفحه ينزل»: the © line is pinned to the screen.
const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')
const footer = readFileSync(new URL('../components/Footer.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../pages/_app.js', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../components/Nav.js', import.meta.url), 'utf8')

describe('fixed © footer (like the Cafeteria app)', () => {
  it('is position fixed at the bottom, on top of the phone tab nav, with the iOS safe area', () => {
    const rule = css.match(/\.app-footer \{[^}]*\}/)[0]
    expect(rule).toMatch(/position: fixed/)
    expect(rule).toMatch(/bottom: var\(--nav-real, 0px\)/)
    expect(rule).toMatch(/env\(safe-area-inset-bottom/)
    expect(css).toMatch(/\.app-footer\[data-on-nav\] \{\s*padding-bottom: 0\.2rem;/)
    expect(nav).toMatch(/<nav data-bottom-nav /)
  })
  it('pads the page by the measured footer + nav height, and the page itself does not rubber-band', () => {
    expect(css).toMatch(/body \{\s*padding-bottom: calc\(var\(--footer-real[^;]*\+ var\(--nav-real, 0px\)\);/)
    expect(css).toMatch(/html \{\s*overscroll-behavior-y: none;/)
    expect(footer).toMatch(/--footer-real/)
    expect(footer).toMatch(/--nav-real/)
  })
  it('stays outside the page content (nothing transforms it) and out of print', () => {
    expect(app.indexOf('<Footer />')).toBeGreaterThan(app.indexOf('<Component {...pageProps} />'))
    expect(footer).toMatch(/className="app-footer print:hidden"/)
    expect(css).toMatch(/@media print \{\s*body \{\s*padding-bottom: 0 !important;\s*\}\s*\.app-footer \{\s*display: none !important;/)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Abdullah 19 Nov «خل الحقوق هي اخر شي»: the © line is the last thing on the screen, below the tab bar.
const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')
const footer = readFileSync(new URL('../components/Footer.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../pages/_app.js', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../components/Nav.js', import.meta.url), 'utf8')

describe('fixed © footer is the last thing on every page', () => {
  it('is position fixed flush to the bottom, centred, link on its own line, Cafeteria size, with the iOS safe area', () => {
    const rule = css.match(/\.app-footer \{[^}]*\}/)[0]
    expect(rule).toMatch(/position: fixed/)
    expect(rule).toMatch(/bottom: 0;/)
    expect(rule).toMatch(/flex-direction: column/)
    expect(rule).toMatch(/env\(safe-area-inset-bottom/)
    expect(rule).toMatch(/font-size: 10\.5px/) // Cafeteria's size
    expect(css).not.toMatch(/\.app-footer\[data-on-nav\]/)
    expect(footer).not.toMatch(/data-on-nav/)
  })
  it('phone tab bar sits directly above the footer; the المزيد sheet opens above both', () => {
    expect(css).toMatch(/\[data-bottom-nav\][,\s.A-Za-z-]*\{\s*bottom: var\(--footer-real/)
    expect(nav).toMatch(/<nav data-bottom-nav /)
    expect(nav).toMatch(/app-bottom-nav/)
    expect(nav).not.toMatch(/bottom-0/)
    expect(nav).not.toMatch(/pb-safe/)
    expect(nav).toMatch(/--nav-real/)
    expect(nav).toMatch(/--footer-real/)
    expect(css).not.toMatch(/footer-inflow/)
    expect(css).not.toMatch(/\.app-footer\.with-nav/)
  })
  it('pads the page by the measured footer + nav height, and the page itself does not rubber-band', () => {
    expect(css).toMatch(/body \{\s*padding-bottom: calc\(var\(--footer-real[^;]*\+ var\(--nav-real, 0px\)/)
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

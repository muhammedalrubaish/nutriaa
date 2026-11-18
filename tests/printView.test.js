import { describe, it, expect } from 'vitest'
import { FULL_PAGE_PRINT_CSS, IOS_TALL_PRINT_CSS, VIEW_CSS, isFullPagePrintEngine, isIosNonSafari } from '@/lib/printView'

describe('print view layout (Abdullah 18 Nov: log report printed shrunk on iPhone)', () => {
  it('takes the app out of layout while the view is open, on screen too, so nothing wider than a sheet is printed', () => {
    const screen = VIEW_CSS.slice(0, VIEW_CSS.indexOf('@media print'))
    expect(screen).toMatch(/html\.print-view-open body > \*:not\(#print-view\):not\(\[data-pv-offscreen\]\) \{ display: none !important; \}/)
    expect(VIEW_CSS).toMatch(/@media print \{[\s\S]*#print-view \{ position: static; overflow: hidden; overflow: clip;[^}]*width: 192mm/)
  })

  it('does not reset the sheet padding (it holds the footer reserve)', () => {
    expect(VIEW_CSS).not.toMatch(/\.doc \.a4 \{[^}]*padding: 0/)
  })

  it('prints full-page sheets with no @page margin only in Chromium outside iOS (drops Chrome\'s URL/date lines)', () => {
    expect(FULL_PAGE_PRINT_CSS).toMatch(/@page \{ size: A4 portrait; margin: 0 \}/)
    expect(FULL_PAGE_PRINT_CSS).toMatch(/\.a4 \{ width: 210mm; height: 296mm; max-height: 296mm; padding: 8mm; \}/)
    const chrome = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', vendor: 'Google Inc.', userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }] } }
    const edge = { ...chrome, userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Microsoft Edge' }] } }
    const safariIphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', vendor: 'Apple Computer, Inc.' }
    const chromeIphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1', vendor: 'Apple Computer, Inc.' }
    const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', vendor: 'Apple Computer, Inc.', maxTouchPoints: 5 }
    const macSafari = { ...ipad, maxTouchPoints: 0 }
    const firefox = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:132.0) Gecko/20100101 Firefox/132.0', vendor: '' }
    expect(isFullPagePrintEngine(chrome)).toBe(true)
    expect(isFullPagePrintEngine(edge)).toBe(true)
    expect(isFullPagePrintEngine({ ...chrome, userAgentData: undefined })).toBe(true)
    for (const n of [safariIphone, chromeIphone, ipad, macSafari, firefox, null]) expect(isFullPagePrintEngine(n)).toBe(false)
  })

  it('gives iPhone browsers other than Safari (no URL/date lines) taller sheets; Safari keeps 242mm', () => {
    expect(IOS_TALL_PRINT_CSS).toMatch(/\.a4 \{ height: 264mm; max-height: 264mm; \}/)
    const ua = (x) => ({ userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${x} Mobile/15E148 Safari/604.1`, vendor: 'Apple Computer, Inc.' })
    expect(isIosNonSafari(ua('CriOS/142.0'))).toBe(true)
    expect(isIosNonSafari(ua('EdgiOS/142.0'))).toBe(true)
    expect(isIosNonSafari(ua('FxiOS/142.0'))).toBe(true)
    expect(isIosNonSafari(ua('Version/26.5'))).toBe(false)
    expect(isIosNonSafari({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36' })).toBe(false)
  })
})

describe('work frames stay laid out while the print view is open (Abdullah 19 Nov «تداخل»)', () => {
  it('does not hide off-screen measuring / PDF frames', async () => {
    const { VIEW_CSS } = await import('../lib/printView.js')
    expect(VIEW_CSS.match(/body > \*:not\(#print-view\):not\(\[data-pv-offscreen\]\)/g)).toHaveLength(2)
    const fs = await import('node:fs')
    expect(fs.readFileSync(new URL('../lib/report/measure.js', import.meta.url), 'utf8')).toMatch(/data-pv-offscreen/)
    expect(fs.readFileSync(new URL('../lib/report/pdf.js', import.meta.url), 'utf8')).toMatch(/data-pv-offscreen/)
  })
})

import { describe, it, expect } from 'vitest'
import { APP_TITLE, COPYRIGHT, IP_NOTE } from '@/lib/constants'
import { issuedHtml, metaRows, reportPages, REPORT_CSS } from '@/lib/report/report'
import { SHEET_CSS } from '@/lib/report/doc'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BRAND = /نيوتريا|Nutriaa|\bNutria\b/i

describe('user-visible branding', () => {
  it('drops نيوتريا from app title, copyright and the IP note', () => {
    expect(APP_TITLE).toBe('قسم خدمات التغذية')
    expect(COPYRIGHT).toBe('© 2026 جميع الحقوق محفوظة — تصميم وتطوير عبدالله الربيش، أخصائي تغذية')
    expect(IP_NOTE.startsWith('النظام —')).toBe(true)
    expect(APP_TITLE).not.toMatch(BRAND)
    expect(COPYRIGHT).not.toMatch(BRAND)
    expect(IP_NOTE).not.toMatch(BRAND)
  })

  it('keeps the report footer on the sheet and does not name نيوتريا', () => {
    const pages = reportPages({
      title: 'تقرير الوجبات الاختيارية',
      periodLabel: '2026-11-18',
      filtersLabel: '',
      generatedAt: new Date('2026-11-18T19:23:00+03:00'),
      generatedBy: 'عبدالله',
      origin: '',
      departments: {},
      orders: [],
      stats: {
        days: 1,
        summary: { total: 0, patient: 0, companion: 0, avgDaily: 0, main: 0, optional: 0, custom: 0 },
        byDepartment: [],
        trend: { unit: 'hour', points: [] },
        byMealTime: [],
        byWeekday: [],
        meals: [],
        byUser: [],
        byMealType: [],
      },
    })
    expect(pages.length).toBeGreaterThan(0)
    expect(pages.every((p) => p.includes('class="a4 has-footer"'))).toBe(true)
    expect(pages.join('')).not.toMatch(BRAND)
    expect(pages.join('')).not.toContain('مملوك') // Abdullah 19 Nov: ownership note removed from reports
    expect(REPORT_CSS + SHEET_CSS).not.toMatch(BRAND)
    // Small, centred footer: © line then «صفحة X من Y».
    expect(pages[0]).toMatch(/<div class="rf"><span>© 2026[^<]*<\/span><span class="pg"[^>]*>صفحة 1 من \d+<\/span><\/div>/)
    expect(REPORT_CSS).toMatch(/\.rf\{[^}]*flex-direction:column[^}]*align-items:center[^}]*text-align:center/)
  })

  it('lays the header meta out as aligned label/value rows with LTR-isolated dates', () => {
    const rows = metaRows({
      periodLabel: '2026-11-18 إلى 2026-11-20',
      filtersLabel: 'القسم: قسم الولادة 1 · المستخدم: سامي',
      generatedAt: new Date('2026-11-18T23:04:00+03:00'),
      generatedBy: 'عبدالله الربيش',
    })
    const keys = [...rows.matchAll(/<span class="k">([^<]*)<\/span>/g)].map((m) => m[1])
    expect(keys).toEqual(['الفترة:', 'القسم:', 'المستخدم:', 'تاريخ الإصدار:', 'بواسطة:'])
    expect(rows).toContain('<span dir="ltr" style="unicode-bidi:isolate">18-11-2026</span> إلى <span dir="ltr" style="unicode-bidi:isolate">20-11-2026</span>')
    expect(issuedHtml(new Date('2026-11-18T23:04:00+03:00'))).toBe('<span dir="ltr" style="unicode-bidi:isolate">18-11-2026</span>، <span dir="ltr" style="unicode-bidi:isolate">11:04</span> م')
    expect(issuedHtml(new Date('2026-11-18T00:30:00+03:00'))).toMatch(/>12:30<\/span> ص$/)
    expect(rows).not.toMatch(/<b>|<br>/)
    expect(REPORT_CSS).toMatch(/\.rh \.meta\{[^}]*display:grid;grid-template-columns:auto auto/)
  })

  it('has no نيوتريا in user-facing source (pages, components, public, lib constants/reports)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const files = [
      'lib/constants.js',
      'lib/fileName.js',
      'lib/report/report.js',
      'lib/report/pdf.js',
      'lib/report/doc.js',
      'pages/_document.js',
      'pages/about.js',
      'pages/login.js',
      'public/manifest.webmanifest',
    ]
    for (const f of files) {
      const text = readFileSync(join(root, f), 'utf8')
      expect(text, f).not.toMatch(BRAND)
    }
  })
})

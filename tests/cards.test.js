// Notes 1, 2, 14: printed meal cards — cards8 layout, 8 per A4 page, PATIENT / MORAFEQ, no author or date.
import { describe, it, expect } from 'vitest'
import { CARDS_CSS, CARDS_PER_PAGE, MIN_CARD_SCALE, cardHtml, cardPages, cardScale, fitCards } from '@/lib/report/cards'
import { PRINT_SHEET, SHEET_CSS } from '@/lib/report/doc'

const DEPTS = {
  ob1: { id: 'ob1', name: 'قسم الولادة ١', sortOrder: 1 },
  gine: { id: 'gine', name: 'قسم الأرحام', sortOrder: 2 },
}
const order = (i, over = {}) => ({
  id: 'o_' + i, department: 'ob1', room: String(126 + (i % 5)), bed: 1 + (i % 4), patientName: 'مريضة ' + i,
  personType: i % 2 ? 'companion' : 'patient', day: 'wed', mealTime: 'lunch', mainMeal: 'كبسة دجاج', mealType: 'main',
  notes: '', createdBy: 'dist', createdByName: 'موزعة الاختبار', createdAt: '2026-11-17T06:15:00Z', ...over,
})

describe('meal cards', () => {
  it('puts exactly 8 cards on each A4 page and pads the last page', () => {
    expect(CARDS_PER_PAGE).toBe(8)
    const pages = cardPages(Array.from({ length: 19 }, (_, i) => order(i)), DEPTS)
    expect(pages).toHaveLength(3)
    for (const p of pages) {
      expect(p.startsWith('<section class="a4">')).toBe(true)
      expect(p.match(/class="mcard"|class="mcard blank"/g)).toHaveLength(8)
    }
    expect(pages[2].match(/class="mcard"/g)).toHaveLength(3)
    expect(pages[2].match(/mcard blank/g)).toHaveLength(5)
  })

  it('lays the page out as 2 columns × 4 rows of landscape cards that never split', () => {
    expect(CARDS_CSS).toMatch(/\.mcards\{[^}]*grid-template-columns:1fr 1fr[^}]*grid-template-rows:repeat\(4,1fr\)/)
    expect(CARDS_CSS).toMatch(/\.mcard\{[^}]*break-inside:avoid/)
    // A4 sheet short enough for iPhone Safari (≈248mm printable once its URL/date header and footer are
    // reserved): 194×242mm, so a sheet of 8 cards never spills a sliver page (37 sheets printed as 74),
    // yet tall enough that the footer prints near the bottom of the paper (not two-thirds down; 232mm was).
    expect(PRINT_SHEET).toEqual({ width: '194mm', height: '242mm', footerReserve: '16mm' })
    expect(SHEET_CSS).toMatch(/\.doc\.print \.a4\{width:194mm;height:242mm;max-height:242mm\}/)
    expect(SHEET_CSS).not.toMatch(/100vh/)
    expect(SHEET_CSS).toMatch(/break-after:page/)
    expect(SHEET_CSS).toMatch(/\.doc\.print \.a4\.has-footer\{padding-bottom:16mm\}/)
    // Footer pinned to the sheet bottom with ≈6mm under it, so it never touches the edge (Abdullah t243u).
    expect(SHEET_CSS).toMatch(/\.doc \.a4 \.rf\{position:absolute;left:0;right:0;bottom:6mm/)
  })

  it('prints room, bed and PATIENT / MORAFEQ bigger and bold (Abdullah 18 Nov)', () => {
    expect(CARDS_CSS).toMatch(/\.mcard \.row\{[^}]*font-size:calc\(13pt \* var\(--s\)\);font-weight:700/)
    expect(CARDS_CSS).toMatch(/\.mcard \.row b\{[^}]*font-size:calc\(16pt \* var\(--s\)\);font-weight:800/)
    const html = cardHtml(order(0, { room: '101', bed: 1 }), 'قسم')
    expect(html).toMatch(/غرفة: <b>101<\/b>/)
    expect(html).toMatch(/سرير: <b>A<\/b>/)
  })

  it('prints PATIENT / MORAFEQ', () => {
    expect(cardHtml(order(0), 'قسم')).toContain('<b>PATIENT</b>')
    expect(cardHtml(order(1), 'قسم')).toContain('<b>MORAFEQ</b>')
  })

  it('never prints who entered the order nor the date or time (note 14)', () => {
    const html = cardPages([order(0), order(1)], DEPTS).join('')
    expect(html).not.toContain('موزعة الاختبار')
    expect(html).not.toContain('2026')
    expect(html).not.toMatch(/\d{1,2}:\d{2}/)
    // The meal and day it is for are printed instead.
    expect(html).toContain('غداء - الأربعاء')
  })

  it('colours main / optional / custom meals and escapes text', () => {
    expect(cardHtml(order(0), 'x')).toContain('background:#15803d')
    expect(cardHtml(order(0, { mealType: 'optional' }), 'x')).toContain('background:#0284c7')
    expect(cardHtml(order(0, { mealType: 'custom' }), 'x')).toContain('background:#7c3aed')
    expect(cardHtml(order(0, { patientName: '<img onerror=x>' }), 'x')).toContain('&lt;img onerror=x&gt;')
  })

  it('sorts by department order, room, then bed', () => {
    const pages = cardPages(
      [
        order(1, { department: 'gine', room: '330', bed: 1, patientName: 'C' }),
        order(2, { room: '140', bed: 2, patientName: 'B' }),
        order(3, { room: '140', bed: 1, patientName: 'A' }),
      ],
      DEPTS,
    )
    const names = [...pages[0].matchAll(/class="name">([^<]+)</g)].map((m) => m[1])
    expect(names).toEqual(['A', 'B', 'C'])
  })

  it('QA round 2: prints the full note, name and meal — never shortened (allergies must not be lost)', () => {
    const note = 'اختبار ملاحظة طويلة: بدون ملح وبدون سكر وحساسية من المكسرات'
    const name = 'عبدالرحمن بن محمد بن عبدالله بن سليمان آل فلان الطويل جداً جداً جداً'
    const meal = 'كبسة دجاج بالأرز البسمتي مع سلطة خضراء وشوربة عدس وزبادي قليل الدسم'
    const html = cardHtml(order(1, { patientName: name, mainMeal: meal, notes: note }), 'قسم')
    expect(html).toContain('حساسية من المكسرات')
    expect(html).toContain(note)
    expect(html).toContain(name)
    expect(html).toContain(meal)
    expect(html).not.toContain('…')
    // The note wraps on its own line; nothing relies on CSS ellipsis/clipping (garbled in RTL PDFs).
    expect(html).toContain('<div class="note">')
    expect(CARDS_CSS).not.toMatch(/text-overflow|line-clamp/)
    expect(CARDS_CSS).toMatch(/\.mcard \.note\{[^}]*overflow-wrap:anywhere[^}]*white-space:normal/)
  })

  it('QA round 2: long text shrinks the card (--s) instead of being cut; short cards keep full size', () => {
    expect(cardScale(order(1))).toBe(1)
    expect(cardHtml(order(1), 'قسم')).toContain('style="--s:1"')
    const longNote = 'حساسية من المكسرات والفول السوداني والسمسم، بدون ملح وبدون سكر، طعام مهروس لين، '.repeat(4)
    const s = cardScale(order(2, { notes: longNote }))
    expect(s).toBeLessThan(1)
    expect(s).toBeGreaterThanOrEqual(MIN_CARD_SCALE)
    const huge = cardScale(order(3, { notes: 'ن'.repeat(500), patientName: 'اسم '.repeat(30), mainMeal: 'وجبة '.repeat(40) }))
    expect(huge).toBe(MIN_CARD_SCALE)
    // Mixed Arabic/Latin notes stay bidi-isolated (RTL-safe in the PDF), and are escaped.
    expect(cardHtml(order(4, { notes: 'بدون RICE (low salt) <b>' }), 'قسم')).toContain('<span dir="ltr" style="unicode-bidi:isolate">RICE (low salt)</span>')
    expect(cardHtml(order(4, { notes: '<b>x' }), 'قسم')).toContain('&lt;b&gt;x')
  })

  it('QA round 2: fitCards shrinks a card whose body still overflows until it fits, never below the minimum', () => {
    const mk = (factor) => {
      const style = { v: '1', getPropertyValue: () => style.v, setProperty: (_k, v) => { style.v = v } }
      const body = { clientHeight: 100, get scrollHeight() { return factor * Number(style.v) } }
      return { style, querySelector: () => body }
    }
    const fitsAt70 = mk(140)
    const never = mk(1000)
    const ok = mk(90)
    fitCards({ querySelectorAll: () => [fitsAt70, never, ok] })
    const v = Number(fitsAt70.style.v)
    expect(v * 140).toBeLessThanOrEqual(101)
    expect(v).toBeGreaterThan(0.68)
    expect(Number(never.style.v)).toBe(MIN_CARD_SCALE)
    expect(ok.style.v).toBe('1')
  })
})


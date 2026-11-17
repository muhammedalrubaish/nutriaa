// Notes 1, 2, 14: printed meal cards — cards8 layout, 8 per A4 page, PATIENT / MORAFEQ, no author or date.
import { describe, it, expect } from 'vitest'
import { CARDS_CSS, CARDS_PER_PAGE, cardHtml, cardPages } from '@/lib/report/cards'
import { SHEET_CSS } from '@/lib/report/doc'

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
    // A4 sheet that fits the printable area (194×276mm inside 8mm margins) and breaks after each page.
    expect(SHEET_CSS).toMatch(/\.doc\.print \.a4\{width:194mm;height:276mm\}/)
    expect(SHEET_CSS).toMatch(/break-after:page/)
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
})

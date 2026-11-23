// Printed meal cards (notes 1, 2, 14). Approved design: cards8 (Abdullah's mock) — 8 landscape cards per
// A4 page (4 rows × 2), explicit pages of 8 so a card never splits across pages (Safari ignores
// break-inside on grid items), sorted by department, room, bed.
import { DAY_NAME, MEAL_TIME_NAME, bedLabel, bidiHtml, esc, personCardLabel } from './common';
/** Approved design: /workspace/nutriaa-mock/cards8.html — 8 landscape cards per A4 (4 rows × 2). */
export const CARDS_PER_PAGE = 8;
const TYPE = {
    main: { label: 'الوجبة الأساسية', color: '#15803d' },
    optional: { label: 'الوجبة الاختيارية', color: '#0284c7' },
    custom: { label: 'وجبة مخصصة', color: '#7c3aed' },
};
// Card text is NEVER shortened (QA round 2: «حساسية من المكسرات» was lost behind a 30-char cut).
// Long text wraps onto more lines and the whole card body scales down (--s) until it fits the fixed card:
//   1. cardScale() estimates the scale in code from the text lengths, so print, screen and the PDF
//      (html2canvas) start from the same, already-fitting size without any JS;
//   2. fitCards() then measures the real layout (print view and PDF iframe, after the fonts load) and
//      shrinks any card that still overflows. No CSS ellipsis / line-clamp anywhere (garbled in RTL PDFs).
export const CARDS_CSS = `
.mcards{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr);gap:3mm;min-height:0}
.mcard{--s:1;border:1.5px solid #cbd5e1;border-radius:4mm;overflow:hidden;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;min-height:0;background:#fff;position:relative}
.mcard.blank{border:none}
/* Basic/main meal only: exactly 10 thin diagonal lines, fixed size, centered in the card
   (not a repeating fill — every main card looks the same regardless of content height). */
.mcard-stripes{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:54mm;height:30mm;z-index:0;pointer-events:none;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
.mcard-stripes svg{display:block;width:54mm;height:30mm}
.mcard[data-meal="main"] .head,.mcard[data-meal="main"] .body{position:relative;z-index:1}
.mcard[data-meal="main"] .name,.mcard[data-meal="main"] .row,.mcard[data-meal="main"] .note,.mcard[data-meal="main"] .foot{background:#fff;padding:0.4mm 1mm;border-radius:1mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
.mcard[data-meal="main"] .tag,.mcard[data-meal="optional"] .tag,.mcard[data-meal="main"] .meal small,.mcard[data-meal="optional"] .meal small{font-weight:700}
.mcard .head{display:flex;justify-content:space-between;align-items:center;gap:2mm;padding:1.8mm 4mm;color:#fff;font-weight:700;font-size:12.5pt;flex-shrink:0}
.mcard .head .dept{min-width:0;overflow-wrap:anywhere;line-height:1.25}
.mcard .tag{background:rgba(255,255,255,.25);border-radius:99px;padding:0 3mm;font-size:9.5pt;white-space:nowrap}
.mcard .body{padding:calc(2mm * var(--s)) 4mm;flex:1;display:flex;flex-direction:column;gap:calc(1.4mm * var(--s));min-height:0;overflow:hidden}
.mcard .name{font-size:calc(17pt * var(--s));font-weight:800;color:#081c44;line-height:1.25;overflow-wrap:anywhere}
.mcard .row{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:5mm;font-size:calc(13pt * var(--s));font-weight:700;color:#334155;white-space:nowrap;line-height:1.3}
.mcard .row b{color:#081c44;font-size:calc(16pt * var(--s));font-weight:800}
.mcard .meal{border-right:2mm solid #081c44;background:#f1f5f9;border-radius:2mm;padding:calc(1.6mm * var(--s)) 3mm;min-height:0}
.mcard .meal small{font-size:calc(9.5pt * var(--s))}
.mcard .meal div{font-size:calc(13.5pt * var(--s));font-weight:800;color:#081c44;line-height:1.3;overflow-wrap:anywhere}
.mcard .note{color:#b91c1c;font-weight:700;font-size:calc(10.5pt * var(--s));line-height:1.35;overflow-wrap:anywhere;white-space:normal}
.mcard .foot{font-size:calc(9.5pt * var(--s));color:#64748b;margin-top:auto;white-space:nowrap;line-height:1.35}
`;
/** Smallest scale fitCards() may reach (≈ 6.5pt for the meal, 5pt for a very long note). */
export const MIN_CARD_SCALE = 0.48;
// Card body box (print, the smaller of print/PDF): (192mm − 3mm gap) / 2 wide, (242mm − 3×3mm) / 4 high,
// minus the coloured head, borders and padding. A safety margin keeps the estimate on the fitting side.
const BODY_W_MM = 94.5 - 8 - 2 - 1;
const BODY_H_MM = 58.25 - 9 - 1 - 3;
const PT = 0.3528; // mm per pt
const CH = 0.5; // average Cairo glyph width (em), Arabic and Latin mixed — deliberately a bit generous
const lines = (text, pt, widthMm) => Math.max(1, Math.ceil(Array.from(String(text || '')).length * pt * PT * CH / widthMm));
function cardHeight(o, s) {
    const name = 17 * s, meal = 13.5 * s, note = 10.5 * s;
    let h = 2 * 2 * s; // body padding
    h += lines(o.patientName || 'بدون اسم', name, BODY_W_MM) * name * PT * 1.25;
    h += 16 * s * PT * 1.3; // النوع / غرفة / سرير (bigger, bold — Abdullah 18 Nov)
    h += 2 * 1.6 * s + 9.5 * s * PT * 1.5 + lines(o.mainMeal, meal, BODY_W_MM - 5) * meal * PT * 1.3;
    if (o.notes)
        h += lines(o.notes, note, BODY_W_MM) * note * PT * 1.35;
    h += 9.5 * s * PT * 1.35; // meal time - day
    h += (o.notes ? 4 : 3) * 1.4 * s; // gaps
    return h;
}
/** Largest scale (1 → MIN_CARD_SCALE, step 0.04) at which the card's full text is estimated to fit. */
export function cardScale(o) {
    for (let s = 1; s > MIN_CARD_SCALE; s = Math.round((s - 0.04) * 100) / 100)
        if (cardHeight(o, s) <= BODY_H_MM)
            return s;
    return MIN_CARD_SCALE;
}
/**
 * Measures the laid-out cards in `root` (a document or element) and shrinks --s on any card whose body
 * still overflows, down to MIN_CARD_SCALE. Runs in the print view and in the PDF iframe once fonts load.
 */
export function fitCards(root) {
    for (const card of root.querySelectorAll('.mcard:not(.blank)')) {
        const body = card.querySelector('.body');
        if (!body)
            continue;
        let s = Number(card.style.getPropertyValue('--s')) || 1;
        while (body.scrollHeight > body.clientHeight + 1 && s > MIN_CARD_SCALE) {
            s = Math.max(MIN_CARD_SCALE, Math.round((s - 0.03) * 100) / 100);
            card.style.setProperty('--s', String(s));
        }
    }
}
/** Note 14: the card never shows who entered the order nor the date/time. Text is shown in full. */
// Exactly 10 thin diagonal lines, 54mm × 30mm, centered in the card. Coordinates are mm (viewBox 0 0 54 30).
export const MAIN_STRIPE_COUNT = 10;
const MAIN_STRIPES = `<div class="mcard-stripes" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="54mm" height="30mm" viewBox="0 0 54 30" overflow="hidden"><line x1="-22.36" y1="30" x2="7.64" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="-14.73" y1="30" x2="15.27" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="-7.09" y1="30" x2="22.91" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="0.55" y1="30" x2="30.55" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="8.18" y1="30" x2="38.18" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="15.82" y1="30" x2="45.82" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="23.45" y1="30" x2="53.45" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="31.09" y1="30" x2="61.09" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="38.73" y1="30" x2="68.73" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/><line x1="46.36" y1="30" x2="76.36" y2="0" stroke="#888" stroke-width="0.35" stroke-linecap="butt"/></svg></div>`;
export function cardHtml(o, deptName) {
    const typeKey = TYPE[o.mealType] ? o.mealType : 'main';
    const t = TYPE[typeKey];
    const name = o.patientName || 'بدون اسم';
    const s = cardScale(o);
    const note = String(o.notes ?? '').replace(/\s+/g, ' ').trim();
    const stripes = typeKey === 'main' ? MAIN_STRIPES : '';
    return `<div class="mcard" data-meal="${typeKey}" style="--s:${s}">${stripes}<div class="head" style="background:${t.color}"><span class="dept">${bidiHtml(deptName)}</span><span class="tag">${t.label}</span></div>
<div class="body"><div class="name">${bidiHtml(name)}</div>
<div class="row"><span>النوع: <b>${personCardLabel(o.personType)}</b></span><span>غرفة: <b>${esc(o.room)}</b></span><span>سرير: <b>${bedLabel(o.bed)}</b></span></div>
<div class="meal"><small style="color:${t.color}">${t.label}</small><div>${bidiHtml(o.mainMeal)}</div></div>
${note ? `<div class="note">${bidiHtml(note)}</div>` : ''}<div class="foot">${esc(MEAL_TIME_NAME[o.mealTime] ?? o.mealTime)} - ${esc(DAY_NAME[o.day] ?? '')}</div></div></div>`;
}
export function cardPages(orders, depts) {
    const sorted = [...orders].sort((a, b) => (depts[a.department]?.sortOrder ?? 99) - (depts[b.department]?.sortOrder ?? 99) ||
        Number(a.room) - Number(b.room) || a.bed - b.bed || a.personType.localeCompare(b.personType));
    const pages = [];
    for (let i = 0; i < sorted.length; i += CARDS_PER_PAGE) {
        const chunk = sorted.slice(i, i + CARDS_PER_PAGE);
        const cells = chunk.map(o => cardHtml(o, depts[o.department]?.name ?? o.department));
        while (cells.length < CARDS_PER_PAGE)
            cells.push('<div class="mcard blank"></div>');
        pages.push(`<section class="a4"><div class="mcards">${cells.join('')}</div></section>`);
    }
    return pages;
}

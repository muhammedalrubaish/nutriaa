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
/* Basic/main meal only: exactly 20 thin diagonal lines in the empty space below the
   meal box (or note) and above the footer. Fixed 80×4.5mm mark, shrinks in height if space is tight. */
.mcard-after{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:0.8mm;flex:0 1 auto;min-height:0;width:100%}
.mcard-after .foot{margin-top:0;align-self:stretch;width:100%;flex-shrink:0}
.mcard-stripes{flex:0 1 4.5mm;width:80mm;height:4.5mm;min-height:3mm;max-height:4.5mm;overflow:hidden;pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
.mcard-stripes svg{display:block;width:80mm;height:100%}
.mcard .tag,.mcard .meal small{font-weight:700}
.mcard .head{display:flex;justify-content:space-between;align-items:center;gap:2mm;padding:1.8mm 4mm;color:#fff;font-weight:700;font-size:12.5pt;flex-shrink:0}
.mcard .head .dept{min-width:0;overflow-wrap:anywhere;line-height:1.25}
.mcard .tag{background:rgba(255,255,255,.25);border-radius:99px;padding:0 3mm;font-size:11pt;white-space:nowrap}
.mcard .body{padding:calc(2mm * var(--s)) 4mm;flex:1;display:flex;flex-direction:column;gap:calc(1.4mm * var(--s));min-height:0;overflow:hidden}
.mcard .name{font-size:calc(17pt * var(--s));font-weight:800;color:#081c44;line-height:1.25;overflow-wrap:anywhere}
.mcard .row{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:5mm;font-size:calc(13pt * var(--s));font-weight:700;color:#334155;white-space:nowrap;line-height:1.3}
.mcard .row b{color:#081c44;font-size:calc(16pt * var(--s));font-weight:800}
.mcard .meal{border-right:2mm solid #081c44;background:#f1f5f9;border-radius:2mm;padding:calc(1.6mm * var(--s)) 3mm;min-height:0}
.mcard .meal small{font-size:calc(11pt * var(--s))}
.mcard .meal div{font-size:calc(13.5pt * var(--s));font-weight:800;color:#081c44;line-height:1.3;overflow-wrap:anywhere}
.mcard .note{color:#b91c1c;font-weight:700;font-size:calc(12.5pt * var(--s));line-height:1.35;overflow-wrap:anywhere;white-space:normal}
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
    const name = 17 * s, meal = 13.5 * s, note = 12.5 * s;
    let h = 2 * 2 * s; // body padding
    h += lines(o.patientName || 'بدون اسم', name, BODY_W_MM) * name * PT * 1.25;
    h += 16 * s * PT * 1.3; // النوع / غرفة / سرير (bigger, bold — Abdullah 18 Nov)
    h += 2 * 1.6 * s + 11 * s * PT * 1.5 + lines(o.mainMeal, meal, BODY_W_MM - 5) * meal * PT * 1.3;
    if (o.notes)
        h += lines(o.notes, note, BODY_W_MM) * note * PT * 1.35;
    h += 9.5 * s * PT * 1.35; // meal time - day
    h += (o.notes ? 4 : 3) * 1.4 * s; // gaps
    // Main cards also reserve the 20-line mark + its gap above the footer (does not apply to optional/custom).
    const typeKey = TYPE[o.mealType] ? o.mealType : 'main';
    if (typeKey === 'main')
        h += MAIN_STRIPE_H_MM + MAIN_STRIPE_GAP_MM;
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
// Exactly 20 thin diagonal lines in an 80×4.5mm mark below the meal/note and above the footer. Coordinates are mm.
export const MAIN_STRIPE_COUNT = 20;
export const MAIN_STRIPE_W_MM = 80;
export const MAIN_STRIPE_H_MM = 4.5;
export const MAIN_STRIPE_GAP_MM = 0.8;
const MAIN_STRIPES = `<div class="mcard-stripes" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="4.5mm" viewBox="0 0 80 4.5" preserveAspectRatio="none" overflow="hidden"><line x1="-0.48" y1="4.5" x2="4.02" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="3.55" y1="4.5" x2="8.05" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="7.57" y1="4.5" x2="12.07" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="11.6" y1="4.5" x2="16.1" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="15.62" y1="4.5" x2="20.12" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="19.64" y1="4.5" x2="24.14" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="23.67" y1="4.5" x2="28.17" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="27.69" y1="4.5" x2="32.19" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="31.71" y1="4.5" x2="36.21" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="35.74" y1="4.5" x2="40.24" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="39.76" y1="4.5" x2="44.26" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="43.79" y1="4.5" x2="48.29" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="47.81" y1="4.5" x2="52.31" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="51.83" y1="4.5" x2="56.33" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="55.86" y1="4.5" x2="60.36" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="59.88" y1="4.5" x2="64.38" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="63.9" y1="4.5" x2="68.4" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="67.93" y1="4.5" x2="72.43" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="71.95" y1="4.5" x2="76.45" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/><line x1="75.98" y1="4.5" x2="80.48" y2="0" stroke="#777" stroke-width="0.4" stroke-linecap="butt"/></svg></div>`;
export function cardHtml(o, deptName) {
    const typeKey = TYPE[o.mealType] ? o.mealType : 'main';
    const t = TYPE[typeKey];
    const name = o.patientName || 'بدون اسم';
    const s = cardScale(o);
    const note = String(o.notes ?? '').replace(/\s+/g, ' ').trim();
    const foot = `<div class="foot">${esc(MEAL_TIME_NAME[o.mealTime] ?? o.mealTime)} - ${esc(DAY_NAME[o.day] ?? '')}</div>`;
    const after = typeKey === 'main' ? `<div class="mcard-after">${MAIN_STRIPES}${foot}</div>` : foot;
    return `<div class="mcard" data-meal="${typeKey}" style="--s:${s}"><div class="head" style="background:${t.color}"><span class="dept">${bidiHtml(deptName)}</span><span class="tag">${t.label}</span></div>
<div class="body"><div class="name">${bidiHtml(name)}</div>
<div class="row"><span>النوع: <b>${personCardLabel(o.personType)}</b></span><span>غرفة: <b>${esc(o.room)}</b></span><span>سرير: <b>${bedLabel(o.bed)}</b></span></div>
<div class="meal"><small style="color:${t.color}">${t.label}</small><div>${bidiHtml(o.mainMeal)}</div></div>
${note ? `<div class="note">${bidiHtml(note)}</div>` : ''}${after}</div></div>`;
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

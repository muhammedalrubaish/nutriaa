// Printed meal cards (notes 1, 2, 14). Approved design: cards8 (Abdullah's mock) — 8 landscape cards per
// A4 page (4 rows × 2), explicit pages of 8 so a card never splits across pages (Safari ignores
// break-inside on grid items), sorted by department, room, bed.
import { DAY_NAME, MEAL_TIME_NAME, bedLabel, bidiHtml, clip, esc, personCardLabel } from './common';
/** Approved design: /workspace/nutriaa-mock/cards8.html — 8 landscape cards per A4 (4 rows × 2). */
export const CARDS_PER_PAGE = 8;
const TYPE = {
    main: { label: 'الوجبة الأساسية', color: '#15803d' },
    optional: { label: 'الوجبة الاختيارية', color: '#0284c7' },
    custom: { label: 'وجبة مخصصة', color: '#7c3aed' },
};
export const CARDS_CSS = `
.mcards{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr);gap:4mm;min-height:0}
.mcard{border:1.5px solid #cbd5e1;border-radius:4mm;overflow:hidden;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;min-height:0;background:#fff}
.mcard.blank{border:none}
.mcard .head{display:flex;justify-content:space-between;align-items:center;gap:2mm;padding:2.2mm 4mm;color:#fff;font-weight:700;font-size:12.5pt}
.mcard .head .dept{white-space:nowrap;min-width:0}
.mcard .tag{background:rgba(255,255,255,.25);border-radius:99px;padding:0 3mm;font-size:9.5pt;white-space:nowrap}
.mcard .body{padding:2mm 4mm;flex:1;display:flex;flex-direction:column;gap:1.4mm;min-height:0}
.mcard .name{font-size:17pt;font-weight:800;color:#081c44;line-height:1.25;overflow-wrap:anywhere}
.mcard .name.long{font-size:13pt;line-height:1.2}
.mcard .meal.tight div{font-size:11.5pt;line-height:1.25}
.mcard .row{display:flex;gap:6mm;font-size:12pt;color:#334155;white-space:nowrap}
.mcard .row b{color:#081c44}
.mcard .meal{border-right:2mm solid #081c44;background:#f1f5f9;border-radius:2mm;padding:1.6mm 3mm;min-height:0}
.mcard .meal small{font-size:9.5pt}
.mcard .meal div{font-size:13.5pt;font-weight:800;color:#081c44;line-height:1.3;overflow-wrap:anywhere}
.mcard .foot{display:flex;justify-content:space-between;gap:3mm;font-size:9.5pt;color:#64748b;margin-top:auto;white-space:nowrap}
.mcard .foot .note{color:#b91c1c;font-weight:700}
`;
/** Note 14: the card never shows who entered the order nor the date/time. */
export function cardHtml(o, deptName) {
    const t = TYPE[o.mealType] ?? TYPE.main;
    // Text is shortened in code, never by CSS ellipsis (garbled by the PDF renderer in RTL).
    const name = o.patientName || 'بدون اسم';
    const long = Array.from(name).length > 26;
    const tight = long && Array.from(o.mainMeal || '').length > 28;
    return `<div class="mcard"><div class="head" style="background:${t.color}"><span class="dept">${bidiHtml(clip(deptName, 26))}</span><span class="tag">${t.label}</span></div>
<div class="body"><div class="name${long ? ' long' : ''}">${bidiHtml(clip(name, 50))}</div>
<div class="row"><span>النوع: <b>${personCardLabel(o.personType)}</b></span><span>غرفة: <b>${esc(o.room)}</b></span><span>سرير: <b>${bedLabel(o.bed)}</b></span></div>
<div class="meal${tight ? ' tight' : ''}"><small style="color:${t.color}">${t.label}</small><div>${bidiHtml(clip(o.mainMeal, 50))}</div></div>
<div class="foot"><span>${esc(MEAL_TIME_NAME[o.mealTime] ?? o.mealTime)} - ${esc(DAY_NAME[o.day] ?? '')}</span>${o.notes ? `<span class="note">${bidiHtml(clip(o.notes, 30))}</span>` : '<span></span>'}</div></div></div>`;
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

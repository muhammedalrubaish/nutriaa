// HTML/CSS charts for the app and the printed/PDF reports (Arabic shaping works in print and canvas).
import { esc } from './common';
export { esc };
export const nf = (n) => new Intl.NumberFormat('en-US').format(n);
export const PALETTE = ['#0284c7', '#0ea5e9', '#2563eb', '#7c3aed', '#059669', '#d97706', '#e11d48', '#0d9488', '#4f46e5', '#db2777', '#65a30d', '#c026d3'];
/** Horizontal bar chart (HTML/CSS so Arabic shaping works in print and in canvas PDF). */
export function hbars(items, o = {}) {
    if (!items.length || items.every(i => i.value === 0))
        return `<div class="ch-empty">${esc(o.empty ?? 'لا توجد بيانات')}</div>`;
    const max = o.max ?? Math.max(1, ...items.map(i => i.value));
    return `<div class="hb">${items.map((i, k) => `
    <div class="hb-row"><div class="hb-l" title="${esc(i.label)}">${esc(i.label)}</div>
      <div class="hb-t"><div class="hb-f" style="width:${Math.max(i.value ? 2 : 0, (i.value / max) * 100).toFixed(1)}%;background:${i.color ?? PALETTE[k % PALETTE.length]}"></div></div>
      <div class="hb-v">${nf(i.value)}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</div></div>`).join('')}</div>`;
}
/** Stacked two-series horizontal bars (e.g. patient vs companion per meal). */
export function hstack(items, o) {
    if (!items.length)
        return `<div class="ch-empty">لا توجد بيانات</div>`;
    const ac = o.aColor ?? '#0284c7', bc = o.bColor ?? '#081c44';
    const max = Math.max(1, ...items.map(i => i.a + i.b));
    return `<div class="legend"><span><i style="background:${ac}"></i>${esc(o.aLabel)}</span><span><i style="background:${bc}"></i>${esc(o.bLabel)}</span></div>
  <div class="hb">${items.map(i => `
    <div class="hb-row"><div class="hb-l" title="${esc(i.label)}">${esc(i.label)}</div>
      <div class="hb-t"><div class="hb-f" style="width:${((i.a / max) * 100).toFixed(1)}%;background:${ac}"></div><div class="hb-f" style="width:${((i.b / max) * 100).toFixed(1)}%;background:${bc}"></div></div>
      <div class="hb-v">${nf(i.a + i.b)}<small>${nf(i.a)} / ${nf(i.b)}</small></div></div>`).join('')}</div>`;
}
/** Vertical columns (trend). */
export function columns(points, o = {}) {
    if (!points.length || points.every(p => p.value === 0))
        return `<div class="ch-empty">لا توجد بيانات</div>`;
    const max = Math.max(1, ...points.map(p => p.value));
    const every = Math.ceil(points.length / 12);
    return `<div class="vc" style="height:${o.height ?? 150}px">${points.map((p, i) => `
    <div class="vc-c"><div class="vc-v">${p.value ? nf(p.value) : ''}</div>
      <div class="vc-b" style="height:${((p.value / max) * 100).toFixed(1)}%;background:${o.color ?? '#0284c7'}"></div>
      <div class="vc-l">${i % every === 0 ? esc(p.label) : ''}</div></div>`).join('')}</div>`;
}
/** Single split bar with legend (share of a whole). */
export function split(parts) {
    const total = parts.reduce((s, p) => s + p.value, 0);
    if (!total)
        return `<div class="ch-empty">لا توجد بيانات</div>`;
    return `<div class="split">${parts.map(p => `<div style="width:${((p.value / total) * 100).toFixed(2)}%;background:${p.color}"></div>`).join('')}</div>
  <div class="legend">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.label)}: <b>${nf(p.value)}</b> (${Math.round((p.value / total) * 100)}%)</span>`).join('')}</div>`;
}
/** Shared chart CSS (used by the app and by printed/PDF reports). */
export const CHART_CSS = `
.hb{display:flex;flex-direction:column;gap:5px}
.hb-row{display:grid;grid-template-columns:minmax(80px,38%) 1fr auto;align-items:center;gap:8px;font-size:12px}
.hb-l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hb-t{height:14px;background:rgba(148,163,184,.18);border-radius:7px;overflow:hidden;display:flex}
.hb-f{height:100%}
.hb-v{font-weight:700;min-width:34px;text-align:left;direction:ltr;unicode-bidi:plaintext}
.hb-v small{display:block;font-weight:400;font-size:10px;opacity:.7}
.vc{display:flex;align-items:flex-end;gap:3px;padding-top:14px}
.vc-c{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.vc-b{width:100%;max-width:28px;border-radius:4px 4px 0 0;min-height:1px}
.vc-v{font-size:9px;font-weight:700;height:12px}
.vc-l{font-size:9px;opacity:.75;height:13px;white-space:nowrap;direction:ltr}
.split{display:flex;height:16px;border-radius:8px;overflow:hidden;background:rgba(148,163,184,.2)}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;margin:6px 0}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-left:5px;vertical-align:middle}
.ch-empty{font-size:12px;opacity:.6;padding:14px 0;text-align:center}
`;

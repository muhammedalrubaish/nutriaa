// Real heights for the report tables, measured in this browser before the sheets are cut (Abdullah 19 Nov
// «املأ الجدول»), and a hard check of the finished sheets (19 Nov «اخر الملف فيه تداخل»). Everything is laid
// out in a hidden iframe with the report's own document CSS, at the exact sheet size used to print or to make
// the PDF, so nothing from the app page (text autosizing, app CSS) changes the result.
// Row heights are the distance between row tops (not the rows' own boxes: WebKit leaves the collapsed
// borders out of a row's box, ≈0.26mm a row, which added up under a full sheet), and the card overhead
// (padding, title, header row, borders) is the card's height minus its rows.
import { docHtml } from './doc';
import { REPORT_CSS, reportTables } from './report';
const PX_MM = 25.4 / 96;
function mountFrame(html) {
    return new Promise((res, rej) => {
        const f = document.createElement('iframe');
        f.setAttribute('aria-hidden', 'true');
        f.setAttribute('data-pv-offscreen', ''); // stays laid out while the print view hides the app (lib/printView.js)
        f.tabIndex = -1;
        f.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;opacity:0;pointer-events:none;color-scheme:light';
        f.onload = () => res(f);
        f.onerror = rej;
        f.srcdoc = html;
        document.body.appendChild(f);
    });
}
async function ready(doc) {
    await Promise.all([400, 600, 700, 800].map(w => doc.fonts?.load?.(`${w} 12px Cairo`, 'ابجد ABC 123')?.catch(() => null)));
    try { await doc.fonts?.ready; } catch { /* ignore */ }
    await Promise.all(Array.from(doc.images).map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
}
/**
 * Sheet geometry for a target: `mode` 'print' | 'pdf' and inline CSS for the sheet (`sheet`, e.g. the iOS
 * Chrome 264mm or Chrome full-page 210×296mm print sheet), same as lib/printView.js applies in print.
 */
export async function measureRowHeights(r, { mode = 'print', sheet = '' } = {}) {
    if (typeof document === 'undefined' || !document.body) return null;
    const tables = reportTables(r);
    const pages = tables.map(t => `<section class="a4" style="${sheet};height:auto;max-height:none">${t.render(t.rows, 0)}</section>`);
    const f = await mountFrame(docHtml({ title: 'measure', pages, mode, origin: r.origin || location.origin, css: REPORT_CSS }));
    try {
        const doc = f.contentDocument;
        await ready(doc);
        const out = { card: 0 };
        doc.querySelectorAll('section').forEach((sec, i) => {
            const box = sec.querySelector('.box.tbl'), trs = Array.from(sec.querySelectorAll('tbody tr'));
            const tops = trs.map(tr => tr.getBoundingClientRect().top), end = sec.querySelector('tbody').getBoundingClientRect().bottom;
            const hs = tops.map((t, j) => ((j + 1 < tops.length ? tops[j + 1] : end) - t) * PX_MM);
            out[tables[i].key] = hs;
            const sum = hs.reduce((a, b) => a + b, 0);
            out.card = Math.max(out.card, box.getBoundingClientRect().height * PX_MM - sum);
        });
        // A frame that was not laid out gives 0mm rows: never trust that (fall back to the estimates).
        const ok = tables.every(t => out[t.key].every(h => h > 2 && h < 80)) && out.card > 8;
        return ok ? out : null;
    }
    finally {
        f.remove();
    }
}
/**
 * mm by which each sheet's content runs past the room above its footer (0 when it fits). Only sheets with
 * report tables are checked (`tablesOnly`), since only those are cut by height.
 */
export async function sheetOverflows(pages, { mode = 'print', sheet = '', origin, css = REPORT_CSS } = {}) {
    if (typeof document === 'undefined' || !document.body) return null;
    const styled = sheet ? pages.map(p => p.replace('<section class="a4', `<section style="${sheet}" class="a4`)) : pages;
    const f = await mountFrame(docHtml({ title: 'check', pages: styled, mode, origin: origin || location.origin, css }));
    try {
        const doc = f.contentDocument;
        await ready(doc);
        const all = Array.from(doc.querySelectorAll('section.a4'));
        if (all.some(sec => !sec.getBoundingClientRect().height)) return null;
        return all.map(sec => {
            if (!sec.querySelector('.box.tbl')) return 0;
            const s = sec.getBoundingClientRect(), pb = parseFloat(doc.defaultView.getComputedStyle(sec).paddingBottom) || 0;
            const limit = s.bottom - pb;
            const els = [...Array.from(sec.querySelector('.sheet-body')?.children || [])];
            const bottom = Math.max(...els.map(e => e.getBoundingClientRect().bottom), -Infinity);
            return Math.max(0, (bottom - limit) * PX_MM);
        });
    }
    finally {
        f.remove();
    }
}

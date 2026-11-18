// Real row heights for the report tables, measured in this browser with the print sheet's CSS and fonts
// before the sheets are cut, so each sheet is filled to capacity (Abdullah 19 Nov «املأ الجدول») without
// guessing how Arabic / Latin text wraps. Measured on the narrowest sheet (192mm print), so wider sheets
// (Chrome full page, PDF) never get taller rows than measured.
import { docCss } from './doc';
import { REPORT_CSS, reportTables } from './report';
const PX_MM = 25.4 / 96;
/** `fullPage`: Chrome/Edge print full-page sheets (210mm with 8mm padding), so measure at that width. */
export async function measureRowHeights(r, { fullPage = false } = {}) {
    if (typeof document === 'undefined' || !document.body)
        return null;
    const tables = reportTables(r);
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-30000px;top:0;visibility:hidden;pointer-events:none;contain:layout style';
    const style = document.createElement('style');
    style.textContent = docCss('screen', location.origin, REPORT_CSS);
    host.innerHTML = `<div class="doc print">${tables.map(t => `<section class="a4" style="height:auto;max-height:none${fullPage ? ';width:210mm;padding:0 8mm' : ''}">${t.render(t.rows, 0)}</section>`).join('')}</div>`;
    document.head.appendChild(style);
    document.body.appendChild(host);
    try {
        await Promise.all([400, 600, 700, 800].map(w => document.fonts?.load?.(`${w} 12px Cairo`, 'ابجد ABC 123')?.catch(() => null)));
        await document.fonts?.ready;
        const sections = host.querySelectorAll('section');
        return Object.fromEntries(tables.map((t, i) => [t.key, Array.from(sections[i].querySelectorAll('tbody tr')).map(tr => tr.getBoundingClientRect().height * PX_MM)]));
    }
    catch {
        return null;
    }
    finally {
        host.remove();
        style.remove();
    }
}

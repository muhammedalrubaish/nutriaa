// A4 sheet document shared by printing (same page) and PDF export.
import { CHART_CSS } from './html';
export const fontFaceCss = (origin) => [400, 600, 700, 800].map(w => `
@font-face{font-family:'Cairo';font-style:normal;font-weight:${w};font-display:block;src:url(${origin}/fonts/cairo-arabic-${w}-normal.woff2) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}
@font-face{font-family:'Cairo';font-style:normal;font-weight:${w};font-display:block;src:url(${origin}/fonts/cairo-latin-${w}-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`).join('');
/**
 * A4 sheets.
 * Print: @page margin 8mm and a 194×232mm sheet. 276mm fitted the CSS printable
 * 281mm (A4 minus 8+8mm) but was taller than iPhone Safari's area once its URL
 * and date header/footer are reserved, so the sheet footer (copyright + page n of m)
 * spilled onto a blank extra page (7 sheets → 14 pages). 250mm (≈709pt) leaves
 * enough room for @page margin plus Safari chrome; the report footer is absolutely
 * placed at the bottom of the sheet so it cannot be pushed off.
 * 250mm still overflowed by ≈1.5mm in iPhone Safari (Abdullah's print of 18 Nov: content from
 * 14.5mm to ≈263mm, i.e. ≈248mm printable), so every card sheet spilled a sliver page
 * (37 sheets → 74 pages) and the report would do the same. 232mm left ≈16mm spare, but then the
 * footer sat around two-thirds of the A4 page with a big blank gap under it (Abdullah, 18 Nov).
 * 242mm fills Safari's ≈248mm area with ≈6mm spare (and Chrome's 281mm easily), so the footer prints
 * near the bottom of the paper. The footer is absolute, 6mm above the sheet's bottom edge, so it never
 * touches the edge in print, on screen or in the PDF; the sheet body reserves room for it.
 * Real iOS print (Chrome on iPhone, iOS 26.5, 18 Nov): the printed page area is 192.96×268.78mm
 * (24.15pt sides, 40pt top/bottom; iOS ignores the @page margin), with Safari's URL/date lines it ends
 * at ≈263mm. The 194mm sheet was 1mm too wide (printed at 99.5%), so sheets are now 192mm wide.
 * iOS browsers other than Safari print no URL/date lines, so lib/printView.js gives them taller sheets.
 * PDF: 210×297mm sheet with 8mm padding, captured one sheet per PDF page.
 * Safari's own URL/date header and footer are a browser setting and cannot be
 * removed reliably with CSS.
 */
export const PRINT_SHEET = { width: '192mm', height: '242mm', footerReserve: '17mm' }
export const SHEET_CSS = `
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{color-scheme:light}
.doc{font-family:Cairo,Tahoma,sans-serif;direction:rtl;color:#0f172a;background:#fff}
.doc .a4{position:relative;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always;display:flex;flex-direction:column;box-sizing:border-box}
.doc .a4:last-child{break-after:auto;page-break-after:auto}
.doc.print .a4{width:192mm;height:242mm;max-height:242mm}
.doc.print .a4.has-footer{padding-bottom:17mm}
.doc.pdf .a4{width:210mm;height:297mm;padding:8mm}
.doc.pdf .a4.has-footer{padding-bottom:23mm}
.doc .sheet-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.doc .a4 .rf{position:absolute;left:0;right:0;bottom:6mm;margin-top:0;background:#fff}
.doc.pdf .a4.has-footer .rf{left:8mm;right:8mm;bottom:8mm}
${CHART_CSS}
`;
export function docCss(mode, origin, extra = '') {
    return `${fontFaceCss(origin)}${SHEET_CSS}${mode === 'print' ? '@page{size:A4 portrait;margin:8mm}' : ''}${extra}`;
}
export function docHtml(o) {
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>${o.title.replace(/</g, '')}</title>
<style>:root{color-scheme:light}html,body{margin:0;padding:0;background:#fff;color:#0f172a}${docCss(o.mode, o.origin, o.css)}</style></head>
<body><div class="doc ${o.mode}">${o.pages.join('')}</div></body></html>`;
}

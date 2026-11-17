// A4 sheet document shared by printing (same page) and PDF export.
import { CHART_CSS } from './html';
export const fontFaceCss = (origin) => [400, 600, 700, 800].map(w => `
@font-face{font-family:'Cairo';font-style:normal;font-weight:${w};font-display:block;src:url(${origin}/fonts/cairo-arabic-${w}-normal.woff2) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}
@font-face{font-family:'Cairo';font-style:normal;font-weight:${w};font-display:block;src:url(${origin}/fonts/cairo-latin-${w}-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`).join('');
/**
 * A4 sheets. Print: @page margin 8mm and a 194×276mm sheet (a little shorter than the
 * printable 281mm so iOS/Android margins never push a sheet onto a second page).
 * PDF: 210×297mm sheet with 8mm padding, captured one sheet per PDF page.
 */
export const SHEET_CSS = `
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{color-scheme:light}
.doc{font-family:Cairo,Tahoma,sans-serif;direction:rtl;color:#0f172a;background:#fff}
.doc .a4{position:relative;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always;display:flex;flex-direction:column}
.doc .a4:last-child{break-after:auto;page-break-after:auto}
.doc.print .a4{width:194mm;height:276mm}
.doc.pdf .a4{width:210mm;height:297mm;padding:8mm}
.doc .sheet-body{flex:1;min-height:0;display:flex;flex-direction:column}
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

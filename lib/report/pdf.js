import { docHtml } from './doc';
import { saveFile } from '../xlsx';
import { fitCards } from './cards';
// Real PDF files without leaving the page: each A4 sheet is rendered in a hidden iframe, captured with
// html2canvas-pro and placed on its own jsPDF page (nothing is ever cut across pages). Never window.open,
// never target=_blank, never navigation.
import { safeFileName as safeName } from '../fileName';
export { safeName };
/** Hands the file over with the app's iOS-safe saver (share sheet on iPhone, download elsewhere). */
export async function deliverFile(blob, fileName) {
    await saveFile(blob, fileName);
}
function mountFrame(html) {
    return new Promise(res => {
        const f = document.createElement('iframe');
        f.setAttribute('aria-hidden', 'true');
        f.tabIndex = -1;
        f.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1200px;border:0;opacity:0;pointer-events:none;color-scheme:light;background:#fff';
        f.onload = () => res(f);
        f.srcdoc = html;
        document.body.appendChild(f);
    });
}
/** Renders each A4 sheet separately → one PDF page per sheet (nothing is ever cut across pages). */
export async function pagesToPdf(o) {
    const f = await mountFrame(docHtml({ title: o.title, pages: o.pages, mode: 'pdf', origin: location.origin, css: o.css }));
    try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
        const doc = f.contentDocument;
        try {
            await doc.fonts?.ready;
        }
        catch { /* ignore */ }
        await Promise.all(Array.from(doc.images).map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
        fitCards(doc); // meal cards: full text, shrunk to fit the PDF sheet's real layout
        const sheets = Array.from(doc.querySelectorAll('.a4'));
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        for (let i = 0; i < sheets.length; i++) {
            o.onProgress?.(i + 1, sheets.length);
            const canvas = await html2canvas(sheets[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
            if (i)
                pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        }
        pdf.setProperties({ title: o.title, author: 'عبدالله الربيش', creator: 'عبدالله الربيش — أخصائي تغذية' });
        return pdf.output('blob');
    }
    finally {
        f.remove();
    }
}
export async function exportPdf(o) {
    const blob = await pagesToPdf(o);
    return deliverFile(blob, `${safeName(o.title)}.pdf`);
}

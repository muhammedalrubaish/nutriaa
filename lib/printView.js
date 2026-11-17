// Same-page print view (no window.open, no new tab, no navigation) for meal cards and reports.
//
// The A4 sheets open in an in-app overlay with «طباعة» / «PDF» / «رجوع» buttons (PR #8's approach: in the
// iPhone home-screen app a window from window.open has no browser controls, so there was no way back).
// @media print hides the app and prints only the sheets, A4 portrait, the same layout on phone and desktop.
//
// iOS-safe: iOS can fire `afterprint` before it has taken the print snapshot, so nothing is torn down on
// afterprint; only the document title is restored, debounced (400 ms), also on a matchMedia('print') "leave",
// with a long fallback timer. The overlay itself stays until the user taps «رجوع» (or Esc).
// While open, the page is forced to a light colour scheme so dark mode never greys the printed sheets.
import { docCss } from './report/doc'
import { escapeHtml } from './format'

export const PRINT_CLEANUP_DELAY_MS = 400
export const PRINT_FALLBACK_MS = 120000
const ROOT_ID = 'print-view'
const OPEN_CLASS = 'print-view-open'

// Sheet width on screen: 194mm ≈ 733px. Phones see a scaled-down preview; printing always uses real size.
const SHEET_PX = 733

const VIEW_CSS = `
  html.${OPEN_CLASS}, html.${OPEN_CLASS} body { overflow: hidden !important; }
  #${ROOT_ID} { position: fixed; inset: 0; z-index: 9999; overflow: auto; -webkit-overflow-scrolling: touch; background: #e5e7eb; color: #111; direction: rtl; font-family: Cairo, Tahoma, Arial, sans-serif; color-scheme: light; }
  #${ROOT_ID} .pv-bar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; justify-content: space-between; align-items: center; padding: 10px 12px; padding-top: calc(10px + env(safe-area-inset-top)); background: #081c44; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
  #${ROOT_ID} .pv-title { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #${ROOT_ID} .pv-actions { display: flex; gap: 6px; flex-shrink: 0; }
  #${ROOT_ID} .pv-bar button { font: inherit; font-size: 14px; font-weight: 700; border: 0; border-radius: 10px; padding: 8px 14px; cursor: pointer; }
  #${ROOT_ID} .pv-print { background: #0284c7; color: #fff; }
  #${ROOT_ID} .pv-pdf { background: #fff; color: #081c44; }
  #${ROOT_ID} .pv-close { background: rgba(255,255,255,.15); color: #fff; }
  #${ROOT_ID} .pv-bar button:disabled { opacity: .6; cursor: wait; }
  #${ROOT_ID} .pv-sheets { padding: 14px; padding-bottom: calc(14px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 14px; }
  #${ROOT_ID} .doc { background: transparent; }
  #${ROOT_ID} .doc .a4 { zoom: var(--pv-zoom, 1); box-shadow: 0 1px 6px rgba(0,0,0,.18); margin: 0 auto 14px; padding: 0; }
  @media print {
    html.${OPEN_CLASS}, html.${OPEN_CLASS} body { overflow: visible !important; height: auto !important; background: #fff !important; color-scheme: light !important; }
    html.${OPEN_CLASS} body > *:not(#${ROOT_ID}) { display: none !important; }
    #${ROOT_ID} { position: static; overflow: visible; background: #fff; }
    #${ROOT_ID} .pv-bar { display: none !important; }
    #${ROOT_ID} .pv-sheets { display: block; padding: 0; }
    #${ROOT_ID} .doc .a4 { zoom: 1; box-shadow: none; margin: 0; }
  }`

let closeActive = null

function waitAssets(root) {
  const imgs = [...root.querySelectorAll('img')]
  return Promise.all([
    ...imgs.map((img) => (img.complete ? null : new Promise((r) => {
      img.addEventListener('load', r, { once: true })
      img.addEventListener('error', r, { once: true })
    }))),
    document.fonts?.ready?.catch(() => {}),
  ])
}

/** Restores the title after a print, iOS-safe (debounced; matchMedia leave; long fallback). */
function watchPrintEnd(onEnd) {
  let done = false
  let timer
  const mql = window.matchMedia ? window.matchMedia('print') : null
  const finish = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    clearTimeout(fallback)
    window.removeEventListener('afterprint', schedule)
    mql?.removeEventListener?.('change', onMql)
    onEnd()
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(finish, PRINT_CLEANUP_DELAY_MS)
  }
  const onMql = (e) => !e.matches && schedule()
  window.addEventListener('afterprint', schedule)
  mql?.addEventListener?.('change', onMql)
  const fallback = setTimeout(finish, PRINT_FALLBACK_MS)
  return finish
}

/**
 * Opens the print view.
 *   title     — toolbar text and the default file name for «Save as PDF».
 *   pages     — A4 sheets (`<section class="a4">…</section>`), see lib/report/*.
 *   css       — sheet-specific CSS (cards, report).
 *   onPdf     — optional async () => void; shows a «PDF» button (real PDF file via share sheet / download).
 *   autoPrint — open the print dialog once images and fonts are ready.
 * Returns a function that closes the view.
 */
export function openPrintView({ title, pages, css = '', onPdf = null, autoPrint = false, count = null }) {
  closeActive?.()
  const html = document.documentElement
  const prevScheme = html.style.colorScheme
  const prevTitle = document.title

  const style = document.createElement('style')
  style.textContent = VIEW_CSS + docCss('print', location.origin, css)
  const root = document.createElement('div')
  root.id = ROOT_ID
  root.setAttribute('dir', 'rtl')
  root.innerHTML = `
    <div class="pv-bar">
      <span class="pv-title">${escapeHtml(title)}${count != null ? ` (${count})` : ''}</span>
      <div class="pv-actions">
        <button type="button" class="pv-print">طباعة</button>
        ${onPdf ? '<button type="button" class="pv-pdf">PDF</button>' : ''}
        <button type="button" class="pv-close">رجوع</button>
      </div>
    </div>
    <div class="pv-sheets"><div class="doc print">${pages.join('')}</div></div>`

  const fit = () => root.style.setProperty('--pv-zoom', String(Math.min(1, (window.innerWidth - 28) / SHEET_PX)))
  const onKey = (ev) => ev.key === 'Escape' && close()
  let stopWatch = null
  function close() {
    stopWatch?.()
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', fit)
    root.remove()
    style.remove()
    html.classList.remove(OPEN_CLASS)
    html.style.colorScheme = prevScheme
    document.title = prevTitle
    if (closeActive === close) closeActive = null
  }
  closeActive = close

  const print = () => {
    document.title = title
    stopWatch?.()
    stopWatch = watchPrintEnd(() => {
      document.title = prevTitle
      stopWatch = null
    })
    window.print()
  }

  root.querySelector('.pv-close').addEventListener('click', close)
  root.querySelector('.pv-print').addEventListener('click', print)
  const pdfBtn = root.querySelector('.pv-pdf')
  if (pdfBtn) {
    pdfBtn.addEventListener('click', async () => {
      pdfBtn.disabled = true
      pdfBtn.textContent = 'جارٍ التجهيز…'
      try {
        await onPdf()
      } catch (e) {
        console.error('[pdf]', e)
        alert('تعذّر إنشاء ملف PDF')
      } finally {
        pdfBtn.disabled = false
        pdfBtn.textContent = 'PDF'
      }
    })
  }
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', fit)
  html.style.colorScheme = 'light'
  document.head.appendChild(style)
  document.body.appendChild(root)
  html.classList.add(OPEN_CLASS)
  fit()

  if (autoPrint) waitAssets(root).then(() => closeActive === close && print())
  return close
}

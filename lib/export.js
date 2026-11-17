// Excel (.xlsx) export and printable meal cards (client side). Department names come from
// the `deptById` map supplied by useDepartments({ all: true }).
import { COPYRIGHT, DAY_BY_ID, MEAL_TIME_BY_ID, bedLabel, personTypeName } from './constants'
import { fmtDate, escapeHtml } from './format'
import { riyadhDate } from './time'
import { downloadXlsx } from './xlsx'

const deptName = (deptById, id) => deptById?.[id]?.name || id

export function exportOrdersXlsx(orders, deptById, name = 'تقرير-الطلبات') {
  const rows = orders.map((o) => [
    deptName(deptById, o.department),
    Number(o.room) || o.room,
    bedLabel(o.bed),
    o.patientName || '',
    personTypeName(o.personType),
    o.day ? DAY_BY_ID[o.day]?.name || o.day : '',
    MEAL_TIME_BY_ID[o.mealTime]?.name || o.mealTime,
    o.mealType === 'main' ? o.mainMeal : '',
    o.mealType === 'optional' ? o.mainMeal : '',
    o.mealType === 'custom' ? o.mainMeal : '',
    o.options?.length ? o.options.join('، ') : '',
    o.notes || '',
    o.createdByName || o.createdBy,
    fmtDate(o.createdAt),
  ])
  return downloadXlsx({
    fileName: `${name}-${riyadhDate()}`,
    sheetName: 'الطلبات',
    header: [
      'القسم', 'الغرفة', 'السرير', 'اسم المريض', 'نوع الشخص', 'اليوم', 'وقت الوجبة',
      'الوجبة الأساسية', 'الوجبة الاختيارية', 'وجبة مخصصة', 'إضافات', 'ملاحظات', 'الموظف', 'تاريخ ووقت التسجيل',
    ],
    widths: [18, 9, 8, 24, 11, 10, 11, 30, 24, 24, 20, 24, 16, 22],
    rows,
  })
}

const mealTypeInfo = (o) =>
  o.mealType === 'optional'
    ? { type: 'الوجبة الاختيارية', color: '#0369a1' }
    : o.mealType === 'custom'
      ? { type: 'وجبة مخصصة', color: '#7c3aed' }
      : { type: 'الوجبة الأساسية', color: '#065f46' }

// Printed labels for the person type (the kitchen staff read these in English on the tray cards).
const PERSON_LABEL = { patient: 'PATIENT', companion: 'MORAFEQ' }

// Cards per printed A4 page: 2 columns x 4 rows. Pages are built explicitly (each one forces a
// page break after it) because Safari ignores `break-inside: avoid` on grid items, which is
// what split cards across two pages.
const CARDS_PER_PAGE = 8

// Everything is scoped to #print-cards so nothing leaks into the app. The cards are shown in an
// in-page overlay instead of a new window: in the iPhone home-screen app a window opened with
// window.open has no browser controls, so there was no way back to the app.
const PRINT_CSS = `
  html.printing-cards, html.printing-cards body { overflow: hidden !important; }
  #print-cards { position: fixed; inset: 0; z-index: 9999; overflow-y: auto; -webkit-overflow-scrolling: touch; background: #e5e7eb; color: #111; direction: rtl; font-family: Cairo, 'Segoe UI', Tahoma, Arial, sans-serif; }
  #print-cards * { margin: 0; padding: 0; box-sizing: border-box; }
  #print-cards .toolbar { position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; justify-content: space-between; align-items: center; padding: 10px 12px; padding-top: calc(10px + env(safe-area-inset-top)); background: #0b518c; color: white; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
  #print-cards .toolbar-title { font-size: 14px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #print-cards .toolbar-actions { display: flex; gap: 8px; flex-shrink: 0; }
  #print-cards .toolbar button { font: inherit; font-size: 15px; font-weight: bold; border: 0; border-radius: 10px; padding: 8px 16px; cursor: pointer; }
  #print-cards .btn-print { background: #7c3aed; color: white; }
  #print-cards .btn-close { background: white; color: #0b518c; }
  #print-cards .sheets { padding: 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 16px; }
  #print-cards .page { width: 190mm; max-width: 100%; background: white; padding: 6mm; box-shadow: 0 1px 6px rgba(0,0,0,.15); }
  /* No gap between cards: neighbours share one 1px line, so each cut is a single cut. The grid draws
     the top and left outer edges, each card its right and bottom edge (RTL: first column is on the right). */
  #print-cards .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; border-top: 1px solid #6b7280; border-left: 1px solid #6b7280; }
  #print-cards .page-footer { margin-top: 3mm; text-align: center; font-size: 8.5pt; color: #6b7280; }
  @media (max-width: 640px) {
    #print-cards .sheets { padding: 10px; gap: 10px; }
    #print-cards .page { padding: 10px; }
    #print-cards .grid { grid-template-columns: 1fr; gap: 10px; border: 0; }
    #print-cards .grid .card { border: 1.5px solid #9ca3af; border-radius: 8px; }
  }
  #print-cards .card { height: 57mm; display: flex; flex-direction: column; background: white; border: 0; border-right: 1px solid #6b7280; border-bottom: 1px solid #6b7280; overflow: hidden; }
  #print-cards .card-header { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 4px 10px; color: white; flex-shrink: 0; }
  #print-cards .dept { font-size: 12pt; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #print-cards .header-end { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  #print-cards .meal-type-badge { font-size: 9pt; font-weight: bold; background: rgba(255,255,255,0.25); padding: 1px 8px; border-radius: 10px; }
  #print-cards .logo { width: 22px; height: 22px; border-radius: 4px; object-fit: cover; }
  #print-cards .card-body { flex: 1; min-height: 0; display: flex; gap: 8px; padding: 6px 10px; }
  #print-cards .who { width: 42%; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  #print-cards .patient-name { font-size: 15pt; font-weight: bold; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  #print-cards .person { align-self: flex-start; font-size: 9pt; font-weight: bold; letter-spacing: .5px; padding: 0 8px; border-radius: 4px; border: 1.5px solid currentColor; direction: ltr; }
  #print-cards .person.patient { color: #065f46; }
  #print-cards .person.companion { color: #0369a1; }
  #print-cards .place { display: flex; gap: 10px; align-items: baseline; font-size: 10pt; color: #4b5563; margin-top: auto; }
  #print-cards .place b { font-size: 15pt; color: #111; }
  #print-cards .meal { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  #print-cards .meal-box { flex: 1; min-height: 0; background: #f3f4f6; border-radius: 6px; padding: 5px 8px; border-right: 4px solid currentColor; overflow: hidden; }
  #print-cards .meal-type-label { font-size: 8.5pt; font-weight: bold; }
  #print-cards .meal-name { font-size: 13.5pt; font-weight: bold; color: #111; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  #print-cards .when { font-size: 10pt; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #print-cards .notes { color: #dc2626; font-weight: bold; }
  #print-cards .card-footer { flex-shrink: 0; display: flex; justify-content: space-between; gap: 6px; font-size: 7.5pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding: 2px 10px; white-space: nowrap; overflow: hidden; }
  @media print {
    html.printing-cards, html.printing-cards body { overflow: visible !important; height: auto !important; background: white !important; }
    html.printing-cards body > *:not(#print-cards) { display: none !important; }
    #print-cards { position: static; overflow: visible; background: white; }
    #print-cards .toolbar { display: none; }
    #print-cards .sheets { display: block; padding: 0; }
    #print-cards .page { width: auto; padding: 0; box-shadow: none; break-after: page; page-break-after: always; }
    #print-cards .page:last-child { break-after: auto; page-break-after: auto; }
    #print-cards .grid { grid-template-columns: repeat(2, 1fr); gap: 0; border-top: 1px solid #6b7280; border-left: 1px solid #6b7280; }
    #print-cards .grid .card { border: 0; border-right: 1px solid #6b7280; border-bottom: 1px solid #6b7280; border-radius: 0; }
    #print-cards * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 portrait; margin: 8mm; }
  }`

let closePrintCards = null

function cardHtml(o, deptById) {
  const e = escapeHtml
  const { type, color } = mealTypeInfo(o)
  const day = o.day ? DAY_BY_ID[o.day]?.name || o.day : ''
  const when = [MEAL_TIME_BY_ID[o.mealTime]?.name || o.mealTime, day].filter(Boolean).map(e).join(' · ')
  const person = PERSON_LABEL[o.personType] || personTypeName(o.personType)
  return `
    <div class="card">
      <div class="card-header" style="background:${color}">
        <span class="dept">${e(deptName(deptById, o.department))}</span>
        <span class="header-end">
          <span class="meal-type-badge">${type}</span>
          <img class="logo" src="/qhc-logo.jpeg" alt="" />
        </span>
      </div>
      <div class="card-body">
        <div class="who">
          <div class="patient-name">${e(o.patientName || 'بدون اسم')}</div>
          <span class="person ${e(o.personType)}">${e(person)}</span>
          <div class="place"><span>غرفة <b>${e(o.room)}</b></span><span>سرير <b>${e(bedLabel(o.bed))}</b></span></div>
        </div>
        <div class="meal" style="color:${color}">
          <div class="meal-box">
            <div class="meal-type-label">${type}</div>
            <div class="meal-name">${e(o.mainMeal)}</div>
          </div>
          <div class="when">${when}${o.notes ? ` · <span class="notes">${e(o.notes)}</span>` : ''}</div>
        </div>
      </div>
      <div class="card-footer"><span>${e(fmtDate(o.createdAt))}</span><span>${e(o.createdByName || o.createdBy)}</span></div>
    </div>`
}

export function printOrderCards(orders, deptById, title = 'بطاقات الوجبات') {
  const e = escapeHtml
  if (closePrintCards) closePrintCards()

  const pages = []
  for (let i = 0; i < orders.length; i += CARDS_PER_PAGE) {
    const cards = orders.slice(i, i + CARDS_PER_PAGE).map((o) => cardHtml(o, deptById)).join('')
    pages.push(`<section class="page"><div class="grid">${cards}</div><div class="page-footer">${e(COPYRIGHT)}</div></section>`)
  }

  const prevTitle = document.title
  const style = document.createElement('style')
  style.textContent = PRINT_CSS
  const root = document.createElement('div')
  root.id = 'print-cards'
  root.setAttribute('dir', 'rtl')
  root.innerHTML = `
    <div class="toolbar">
      <span class="toolbar-title">${e(title)} (${orders.length})</span>
      <div class="toolbar-actions">
        <button type="button" class="btn-print">طباعة</button>
        <button type="button" class="btn-close">رجوع</button>
      </div>
    </div>
    <div class="sheets">${pages.join('')}</div>`

  const onKey = (ev) => ev.key === 'Escape' && close()
  function close() {
    document.removeEventListener('keydown', onKey)
    root.remove()
    style.remove()
    document.documentElement.classList.remove('printing-cards')
    document.title = prevTitle
    closePrintCards = null
  }
  closePrintCards = close
  // The page title becomes the default PDF file name when saving as PDF.
  const print = () => {
    document.title = title
    window.print()
  }

  root.querySelector('.btn-close').addEventListener('click', close)
  root.querySelector('.btn-print').addEventListener('click', print)
  document.addEventListener('keydown', onKey)
  document.head.appendChild(style)
  document.body.appendChild(root)
  document.documentElement.classList.add('printing-cards')

  // Open the print dialog once the logo has loaded; the overlay and its back button stay either way.
  const pending = [...root.querySelectorAll('img')].filter((i) => !i.complete)
  Promise.all(
    pending.map((i) => new Promise((r) => {
      i.addEventListener('load', r, { once: true })
      i.addEventListener('error', r, { once: true })
    })),
  ).then(() => closePrintCards === close && print())
}

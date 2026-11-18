// Excel (.xlsx) export and printable meal cards (client side). Department names come from
// the `deptById` map supplied by useDepartments({ all: true }).
import { DAY_BY_ID, MEAL_TIME_BY_ID, PERSON_CARD_LABEL, bedLabel, personTypeName } from './constants'
import { openPrintView, printSheetCss, printSheetExtraMm } from './printView'
import { CARDS_CSS, cardPages } from './report/cards'
import { riyadhDate } from './time'
import { downloadXlsx } from './xlsx'

const deptName = (deptById, id) => deptById?.[id]?.name || id

/** "2026-11-17 14:05" (Riyadh, 24h, Latin digits, no bidi marks) — sorts correctly in Excel. */
const stampFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
export function excelStamp(iso) {
  if (!iso) return ''
  const p = Object.fromEntries(stampFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

/**
 * Excel file name: «name-YYYY-MM-DD». QA round 2: a log filtered by a (meal) date is named after that
 * date, not today's; without a valid filter date it falls back to today (Riyadh).
 */
export function ordersXlsxName(name, { dated = true, date = '' } = {}) {
  if (!dated) return name
  return `${name}-${/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? date : riyadhDate()}`
}

export function exportOrdersXlsx(orders, deptById, name = 'تقرير-الطلبات', extraSheets = [], { dated = true, date = '' } = {}) {
  const rows = orders.map((o) => [
    deptName(deptById, o.department),
    Number(o.room) || o.room,
    bedLabel(o.bed),
    o.patientName || '',
    personTypeName(o.personType),
    PERSON_CARD_LABEL[o.personType] || '',
    o.day ? DAY_BY_ID[o.day]?.name || o.day : '',
    o.mealDate || '',
    MEAL_TIME_BY_ID[o.mealTime]?.name || o.mealTime,
    o.mealType === 'main' ? o.mainMeal : '',
    o.mealType === 'optional' ? o.mainMeal : '',
    o.mealType === 'custom' ? o.mainMeal : '',
    o.options?.length ? o.options.join('، ') : '',
    o.notes || '',
    o.createdByName || o.createdBy,
    excelStamp(o.createdAt),
  ])
  return downloadXlsx({
    fileName: ordersXlsxName(name, { dated, date }),
    sheetName: 'الطلبات',
    header: [
      'القسم', 'الغرفة', 'السرير', 'اسم المريض', 'نوع الشخص', 'TYPE', 'اليوم', 'تاريخ الوجبة', 'وقت الوجبة',
      'الوجبة الأساسية', 'الوجبة الاختيارية', 'وجبة مخصصة', 'إضافات', 'ملاحظات', 'الموظف', 'تاريخ ووقت التسجيل',
    ],
    widths: [18, 9, 8, 26, 11, 11, 10, 13, 11, 30, 24, 24, 20, 24, 18, 18],
    rows,
    extraSheets,
  })
}

/**
 * Meal cards in the same-page print view (notes 1, 2, 14): cards8 layout, 8 per A4 page, PATIENT / MORAFEQ,
 * no author and no date/time on the card. «PDF» saves the same sheets as a real PDF file.
 */
export async function printOrderCards(orders, deptById, title = 'بطاقات الوجبات') {
  const pages = cardPages(orders, deptById || {})
  return openPrintView({
    title,
    pages,
    css: CARDS_CSS,
    count: orders.length,
    autoPrint: true,
    onPdf: async () => {
      const { exportPdf } = await import('./report/pdf')
      await exportPdf({ title, pages, css: CARDS_CSS })
    },
  })
}

/**
 * The period report (dashboard, note 3) or the log report (same filters as the log, note 4), as A4 sheets:
 * logo, KPIs, patients vs companions, main vs optional, by department / day / meal time / staff, most and
 * least requested meals (note 5), meals compared by times chosen, the detailed table and the copyright.
 * Statistics are computed here from the orders of the period, so the report always matches its filters.
 *   r: { kind: 'period'|'log', title, periodLabel, filtersLabel, orders, from, to, departments (list),
 *        deptById, users ([{ username, name, role }]), menu, generatedBy }
 */
export async function buildReport(r, { pdf = false } = {}) {
  const [{ computeStats }, { reportPages, REPORT_CSS, PDF_SHEET_EXTRA_MM }] = await Promise.all([import('./report/stats'), import('./report/report')])
  const stats = computeStats(r.orders, {
    from: r.from, to: r.to, minDaily: 0, departments: r.departments || [], users: r.users || [], menu: r.menu || null,
  })
  // Print sheets follow this browser's print area; the «PDF» file has its own taller 210×297mm sheets, so its
  // tables are packed again for that height (Abdullah 19 Nov: the PDF had ≈36mm empty under every table).
  const base = { ...r, stats, departments: r.deptById || {}, origin: location.origin, extraSheetMm: pdf ? PDF_SHEET_EXTRA_MM : printSheetExtraMm() }
  const target = pdf ? { mode: 'pdf', sheet: '' } : { mode: 'print', sheet: printSheetCss() }
  const { measureRowHeights, sheetOverflows } = await import('./report/measure')
  const rowHeights = await measureRowHeights(base, target).catch(() => null)
  let guardMm = 0
  let pages = reportPages({ ...base, rowHeights, guardMm })
  // Hard guard (Abdullah 19 Nov «اخر الملف فيه تداخل»): lay the finished sheets out at their real size and,
  // while any table sheet runs past the room above its footer, cut the tables again with that much less room.
  for (let i = 0; i < 6; i++) {
    const over = await sheetOverflows(pages, { ...target, origin: base.origin, css: REPORT_CSS }).catch(() => null)
    const worst = over ? Math.max(0, ...over) : 0
    if (worst <= 0.2) break
    guardMm += worst + 1
    pages = reportPages({ ...base, rowHeights, guardMm })
  }
  return { stats, pages, css: REPORT_CSS, title: `${r.title} - ${r.periodLabel}` }
}

/** Opens the report in the same-page print view, with «طباعة» and «PDF» (its own sheets, packed for A4 PDF). */
export async function openReport(r) {
  const rep = await buildReport(r)
  return openPrintView({
    title: rep.title,
    pages: rep.pages,
    css: rep.css,
    onPdf: async () => {
      const [{ exportPdf }, pdfRep] = await Promise.all([import('./report/pdf'), buildReport(r, { pdf: true })])
      await exportPdf({ title: pdfRep.title, pages: pdfRep.pages, css: pdfRep.css })
    },
  })
}

/** Excel twin of the report: the orders sheet plus summary, meal ranking (note 5) and staff sheets. */
export async function exportReportXlsx(r) {
  const { stats } = await buildReport(r)
  const { roleName } = await import('./roles')
  const extra = [
    {
      name: 'ملخص', header: ['المؤشر', 'القيمة'], widths: [34, 16],
      rows: [
        ['الفترة', r.periodLabel], ['عدد الأيام', stats.days], ['إجمالي الطلبات', stats.summary.total],
        ['المرضى (PATIENT)', stats.summary.patient], ['المرافقون (MORAFEQ)', stats.summary.companion],
        ['المتوسط اليومي', stats.summary.avgDaily], ['الوجبة الأساسية', stats.summary.main],
        ['الوجبات الاختيارية', stats.summary.optional], ['وجبات مخصصة', stats.summary.custom],
        ...stats.byDepartment.map((d) => [`قسم: ${d.name}`, d.total]),
        ...stats.byMealTime.map((m) => [`وقت: ${m.name}`, m.count]),
        ...stats.byWeekday.map((d) => [`يوم: ${d.name}`, d.count]),
      ],
    },
    {
      name: 'الوجبات', header: ['الترتيب', 'الوجبة', 'العدد', 'النسبة %', 'مريض', 'مرافق', 'أساسية', 'اختيارية'],
      widths: [9, 40, 10, 10, 10, 10, 10, 10],
      rows: stats.meals.filter((m) => m.total > 0).map((m, i) => [i + 1, m.name, m.total, m.pct, m.patient, m.companion, m.main, m.optional]),
    },
    {
      name: 'المستخدمون', header: ['الموظف', 'الدور', 'عدد الطلبات'], widths: [28, 18, 14],
      rows: stats.byUser.map((u) => [u.name, roleName(u.role), u.total]),
    },
  ]
  const period = r.from && r.to ? (r.from === r.to ? r.from : `${r.from}_${r.to}`) : riyadhDate()
  return exportOrdersXlsx(r.orders, r.deptById, `${r.title}-${period}`, extra, { dated: false })
}

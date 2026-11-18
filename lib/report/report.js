import { APP_SUBTITLE, APP_TITLE, COPYRIGHT, DAY_NAME, bidiHtml, clip, LOGO_SRC, MEAL_TIME_NAME, MEAL_TYPE_NAME, bedLabel, deptHex, fmtCompact, personName, roleName } from './common';
import { topBottom } from './stats';
import { columns, esc, hbars, hstack, nf, split } from './html';
export const REPORT_CSS = `
.rh{display:flex;align-items:center;gap:4mm;border-bottom:1.2mm solid #081c44;padding-bottom:3mm;margin-bottom:3mm}
.rh img{width:30mm;height:21mm;object-fit:cover;border-radius:2mm}
.rh .t1{font-size:15pt;font-weight:800;color:#081c44;line-height:1.3}
.rh .t2{font-size:10.5pt;color:#334155}
.rh .t3{font-size:12pt;font-weight:700;color:#0284c7;margin-top:1mm}
.rh .meta{margin-inline-start:auto;align-self:center;display:grid;grid-template-columns:auto auto;column-gap:2mm;row-gap:.6mm;font-size:8.5pt;line-height:1.45;text-align:right;direction:rtl}
.rh .meta .k{color:#64748b;font-weight:600;white-space:nowrap}
.rh .meta .v{color:#0f172a;font-weight:600;white-space:nowrap}
.rh.small{padding-bottom:2mm;margin-bottom:2.5mm;border-bottom-width:.8mm}
.rh.small img{width:16mm;height:11mm}
.rh.small .t1{font-size:11pt}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:2.5mm;margin-bottom:3mm}
.kpi{border:1px solid #e2e8f0;border-radius:2.5mm;padding:2mm 3mm;background:#f8fafc}
.kpi b{display:block;font-size:17pt;color:#081c44;line-height:1.2;direction:ltr;text-align:right}
.kpi span{font-size:8.5pt;color:#475569}
.kpi.accent{background:#081c44;border-color:#081c44}.kpi.accent b,.kpi.accent span{color:#fff}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:3mm}
.box{border:1px solid #e2e8f0;border-radius:2.5mm;padding:2.5mm 3mm;break-inside:avoid;min-width:0}
.box h3{margin:0 0 2mm;font-size:10.5pt;color:#081c44;font-weight:800}
.box h3 small{font-weight:400;color:#64748b;font-size:8.5pt;margin-inline-start:2mm}
.mb{margin-bottom:3mm}
.tb3{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.rank{display:flex;flex-direction:column;gap:1.5mm}
.rank div{display:flex;align-items:center;gap:2mm;font-size:9.5pt;border-radius:2mm;padding:1.4mm 2mm}
.rank .n{width:6mm;height:6mm;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:8.5pt;flex-shrink:0}
.rank .m{flex:1;min-width:0;overflow-wrap:anywhere;line-height:1.25}
.rank .c{font-weight:800;direction:ltr}
.top div{background:#ecfdf5}.top .n{background:#059669}
.low div{background:#fff1f2}.low .n{background:#e11d48}
table.t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.6pt}
table.t th{background:#081c44;color:#fff;font-weight:700;padding:1.3mm 1.2mm;text-align:right}
table.t td{padding:.5mm 1mm;height:6.6mm;border-bottom:1px solid #e2e8f0;white-space:normal;overflow-wrap:anywhere;line-height:1.18;vertical-align:middle}
table.t tr:nth-child(even) td{background:#f8fafc}
table.t td.num{direction:ltr;text-align:right}
table.t td.dt{font-size:8pt;white-space:nowrap;padding:0 .8mm}
.rf{padding-top:1.5mm;border-top:1px solid #cbd5e1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:.3mm;font-size:7pt;line-height:1.35;color:#64748b}
.rf .pg{font-weight:600;color:#475569}
.ip{font-size:6.8pt;color:#94a3b8;margin-top:1.5mm;text-align:center;line-height:1.35}
.grid2.grow{flex:1;margin-bottom:0;min-height:0}
.box.grow{flex:1;display:flex;flex-direction:column;min-height:0}
.box.grow .vc{flex:1;height:auto !important;min-height:120px}
.a4 .sheet-body{overflow:hidden}
.a4 .hb{gap:3px}
.a4 .hb-row{font-size:10.5px;gap:6px}
.a4 .hb-t{height:11px}
.a4 .hb-v small{display:inline;margin:0 4px}
.a4 .legend{font-size:10.5px;margin:3px 0}
`;
// Cells wrap (max 2 lines, shortened in code by clip()) instead of CSS ellipsis, which the PDF
// renderer garbles in RTL. 20 rows of up to 2 lines fit the 242mm iPhone-Safari-safe print sheet with
// its 16mm footer reserve (24 rows were clipped once cells wrapped after the sheet shrank from 250mm).
const ROWS_PER_PAGE = 20;
const MEAL_ROWS_PER_PAGE = 30;
// «18-11-2026، 11:04 م» — date and time as isolated LTR runs so «م» and the digits keep one RTL order
// in print and in the PDF (html2canvas); the period uses the same DD-MM-YYYY style.
const issuedFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });
const ltr = (v) => `<span dir="ltr" style="unicode-bidi:isolate">${esc(v)}</span>`;
export function issuedHtml(d) {
    const p = Object.fromEntries(issuedFmt.formatToParts(d).map(x => [x.type, x.value]));
    const pm = String(p.dayPeriod || '').toLowerCase().startsWith('p');
    return `${ltr(`${p.day}-${p.month}-${p.year}`)}، ${ltr(`${p.hour === '0' || p.hour === '00' ? '12' : p.hour}:${p.minute}`)} ${pm ? 'م' : 'ص'}`;
}
/** «2026-11-18» / «2026-11-18 إلى 2026-11-20» → «18-11-2026» / «18-11-2026 إلى 20-11-2026». */
const periodHtml = (label) => String(label ?? '').split(/(\d{4}-\d{2}-\d{2})/).map(t => /^\d{4}-\d{2}-\d{2}$/.test(t) ? ltr(t.split('-').reverse().join('-')) : bidiHtml(t)).join('');
/** Label / value rows of the header meta block, all the same size and weight, aligned in two columns. */
export function metaRows(r) {
    const rows = [['الفترة', periodHtml(r.periodLabel)]];
    for (const f of String(r.filtersLabel || '').split(' · ').filter(Boolean)) {
        const k = f.indexOf(': ');
        rows.push(k > 0 ? [esc(f.slice(0, k)), bidiHtml(f.slice(k + 2))] : ['التصفية', bidiHtml(f)]);
    }
    rows.push(['تاريخ الإصدار', issuedHtml(r.generatedAt ?? new Date())]);
    if (r.generatedBy)
        rows.push(['بواسطة', bidiHtml(r.generatedBy)]);
    return rows.map(([k, v]) => `<span class="k">${k}:</span><span class="v">${v}</span>`).join('');
}
function header(r, small) {
    return `<div class="rh${small ? ' small' : ''}"><img src="${r.origin}${LOGO_SRC}" alt="">
  <div><div class="t1">${esc(APP_TITLE)}</div>${small ? `<div class="t2">${esc(r.title)} — ${periodHtml(r.periodLabel)}</div>` : `<div class="t2">${esc(APP_SUBTITLE)}</div><div class="t3">${esc(r.title)}</div>`}</div>
  ${small ? '' : `<div class="meta">${metaRows(r)}</div>`}</div>`;
}
// Small, centred two-line footer: © line, then «صفحة X من Y».
const footer = (i, n) => `<div class="rf"><span>${esc(COPYRIGHT)}</span><span class="pg" style="white-space:nowrap">صفحة ${i} من ${n}</span></div>`;
const kpi = (label, v, accent = false) => `<div class="kpi${accent ? ' accent' : ''}"><b>${typeof v === 'number' ? nf(v) : esc(v)}</b><span>${esc(label)}</span></div>`;
function rankList(items, cls) {
    if (!items.length)
        return '<div class="ch-empty">لا توجد بيانات</div>';
    return `<div class="rank ${cls}">${items.map((m, i) => `<div><span class="n">${i + 1}</span><span class="m">${bidiHtml(clip(m.name, 60))}</span><span class="c">${nf(m.total)} <small>(${m.pct}%)</small></span></div>`).join('')}</div>`;
}
export function reportPages(r) {
    const s = r.stats;
    const body = [];
    // ---- page 1: summary, patients vs companions, main vs optional, departments, trend
    const deptItems = s.byDepartment.map(d => ({ label: d.name, value: d.total, color: deptHex(d.color) }));
    body.push(`
  <div class="kpis">
    ${kpi('إجمالي الطلبات', s.summary.total, true)}${kpi('المرضى (PATIENT)', s.summary.patient)}${kpi('المرافقون (MORAFEQ)', s.summary.companion)}${kpi('المتوسط اليومي', s.summary.avgDaily)}
    ${kpi('الوجبة الأساسية', s.summary.main)}${kpi('الوجبات الاختيارية', s.summary.optional)}${kpi('وجبات مخصصة', s.summary.custom)}${kpi('عدد الأيام', s.days)}
  </div>
  <div class="grid2">
    <div class="box"><h3>المرضى مقابل المرافقين</h3>${split([{ label: 'مرضى', value: s.summary.patient, color: '#0284c7' }, { label: 'مرافقون', value: s.summary.companion, color: '#081c44' }])}</div>
    <div class="box"><h3>الأساسية مقابل الاختيارية</h3>${split([{ label: 'أساسية', value: s.summary.main, color: '#15803d' }, { label: 'اختيارية', value: s.summary.optional, color: '#0284c7' }, { label: 'مخصصة', value: s.summary.custom, color: '#7c3aed' }])}</div>
  </div>
  <div class="grid2">
    <div class="box"><h3>الطلبات حسب القسم</h3>${hbars(deptItems.slice(0, 16))}</div>
    <div class="box"><h3>حسب القسم: مرضى / مرافقون</h3>${hstack(s.byDepartment.filter(d => d.total).slice(0, 16).map(d => ({ label: d.name, a: d.patient, b: d.companion })), { aLabel: 'مرضى', bLabel: 'مرافقون' })}</div>
  </div>
  <div class="box grow"><h3>اتجاه الطلبات <small>${{ hour: 'حسب الساعة', day: 'حسب اليوم', week: 'حسب الأسبوع', month: 'حسب الشهر' }[s.trend.unit]}</small></h3>${columns(s.trend.points.map(p => ({ label: p.label, value: p.count })), { height: 120 })}</div>`);
    // ---- page 2: meal time / weekday, most & least requested (note 5), staff, meal types
    const tb = topBottom(s.meals);
    const used = s.meals.filter(m => m.total > 0);
    body.push(`
  <div class="grid2">
    <div class="box"><h3>حسب وقت الوجبة</h3>${hbars(s.byMealTime.map(m => ({ label: m.name, value: m.count })))}</div>
    <div class="box"><h3>حسب يوم الأسبوع</h3>${hbars(s.byWeekday.map(d => ({ label: d.name, value: d.count })))}</div>
  </div>
  <div class="tb3 mb">
    <div class="box"><h3>الأكثر طلباً <small>أعلى 3</small></h3>${rankList(tb.top, 'top')}</div>
    <div class="box"><h3>الأقل طلباً <small>أقل 3 من وجبات القائمة</small></h3>${rankList(tb.bottom, 'low')}</div>
  </div>
  <div class="grid2 grow">
    <div class="box"><h3>حسب المستخدم (مدخل الطلب)</h3>${hbars(s.byUser.slice(0, 14).map(u => ({ label: u.name, value: u.total, sub: roleName(u.role) })))}</div>
    <div class="box"><h3>الوجبات حسب النوع</h3>${hbars(s.byMealType.map(m => ({ label: m.name, value: m.count, color: m.id === 'main' ? '#15803d' : m.id === 'optional' ? '#0284c7' : '#7c3aed' })))}</div>
  </div>`);
    // ---- page 3: meals compared by times chosen, patient vs companion
    body.push(`<div class="box grow"><h3>مقارنة الوجبات بعدد مرات الاختيار <small>مريض / مرافق — أعلى ${Math.min(24, used.length)}</small></h3>
    ${hstack(used.slice(0, 24).map(m => ({ label: m.name, a: m.patient, b: m.companion })), { aLabel: 'مريض', bLabel: 'مرافق' })}</div>`);
    // ---- meals ranking table
    for (let i = 0; i < Math.max(1, used.length); i += MEAL_ROWS_PER_PAGE) {
        const chunk = used.slice(i, i + MEAL_ROWS_PER_PAGE);
        body.push(`<div class="box" style="flex:1"><h3>ترتيب الوجبات ${i ? '(تابع)' : ''}</h3>
    <table class="t"><colgroup><col style="width:7%"><col style="width:41%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:7.5%"><col style="width:7.5%"></colgroup>
    <thead><tr><th>#</th><th>الوجبة</th><th>العدد</th><th>النسبة</th><th>مريض</th><th>مرافق</th><th>أساسية</th><th>اختيارية</th></tr></thead>
    <tbody>${chunk.map((m, k) => `<tr><td class="num">${i + k + 1}</td><td title="${esc(m.name)}">${bidiHtml(clip(m.name, 70))}${m.custom && !m.main && !m.optional ? ' <small style="color:#7c3aed">(مخصصة)</small>' : ''}</td><td class="num"><b>${nf(m.total)}</b></td><td class="num">${m.pct}%</td><td class="num">${nf(m.patient)}</td><td class="num">${nf(m.companion)}</td><td class="num">${nf(m.main)}</td><td class="num">${nf(m.optional)}</td></tr>`).join('') || '<tr><td colspan="8">لا توجد طلبات</td></tr>'}</tbody></table></div>`);
    }
    // ---- detailed orders table
    const rows = [...r.orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
        const chunk = rows.slice(i, i + ROWS_PER_PAGE);
        body.push(`<div class="box" style="flex:1"><h3>تفاصيل الطلبات <small>${nf(i + 1)}–${nf(i + chunk.length)} من ${nf(rows.length)}</small></h3>
    <table class="t"><colgroup><col style="width:4%"><col style="width:11.5%"><col style="width:7%"><col style="width:19%"><col style="width:5.5%"><col style="width:6.5%"><col style="width:5%"><col style="width:17%"><col style="width:14%"><col style="width:10.5%"></colgroup>
    <thead><tr><th>#</th><th>القسم</th><th>غرفة/سرير</th><th>الاسم</th><th>النوع</th><th>اليوم</th><th>الوقت</th><th>الوجبة</th><th>المدخل</th><th>وقت الإدخال</th></tr></thead>
    <tbody>${chunk.map((o, k) => `<tr><td class="num">${i + k + 1}</td><td>${bidiHtml(clip(r.departments[o.department]?.name ?? o.department, 22))}</td><td class="num">${esc(o.room)}-${bedLabel(o.bed)}</td><td>${bidiHtml(clip(o.patientName, 40))}</td><td>${personName(o.personType)}</td><td>${esc(DAY_NAME[o.day] ?? '')}</td><td>${esc(MEAL_TIME_NAME[o.mealTime] ?? '')}</td><td title="${esc(MEAL_TYPE_NAME[o.mealType])}">${bidiHtml(clip(o.mainMeal, 36))}</td><td>${bidiHtml(clip(o.createdByName, 30))}</td><td class="num dt">${esc(fmtCompact(o.createdAt))}</td></tr>`).join('')}</tbody></table></div>`);
    }
    const n = body.length;
    return body.map((b, i) => `<section class="a4 has-footer">${header(r, i > 0)}<div class="sheet-body">${b}</div>${i === n - 1 ? `<div class="ip">النظام مملوك فكرياً لمصممه ومطوّره عبدالله الربيش، أخصائي تغذية. لا يجوز نسخه أو إعادة استخدامه دون إذن خطي.</div>` : ''}${footer(i + 1, n)}</section>`);
}

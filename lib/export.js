// CSV export and printable meal cards (client side). Department names come from
// the `deptById` map supplied by useDepartments({ all: true }).
import { DAY_BY_ID, MEAL_TIME_BY_ID, bedLabel, personTypeName } from './constants'
import { fmtDate, escapeHtml } from './format'
import { riyadhDate } from './time'

const deptName = (deptById, id) => deptById?.[id]?.name || id

export function exportOrdersCsv(orders, deptById, name = 'تقرير-الطلبات') {
  const rows = orders.map((o) => [
    deptName(deptById, o.department),
    o.room,
    bedLabel(o.bed),
    o.patientName || '',
    personTypeName(o.personType),
    o.day ? DAY_BY_ID[o.day]?.name || o.day : '',
    MEAL_TIME_BY_ID[o.mealTime]?.name || o.mealTime,
    o.mealType === 'main' ? o.mainMeal : '',
    o.mealType === 'optional' ? o.mainMeal : '',
    o.mealType === 'custom' ? o.mainMeal : '',
    o.notes || '',
    o.createdByName || o.createdBy,
    fmtDate(o.createdAt),
  ])
  const header = [
    'القسم', 'الغرفة', 'السرير', 'اسم المريض', 'نوع الشخص', 'اليوم', 'وقت الوجبة',
    'الوجبة الأساسية', 'الوجبة الاختيارية', 'وجبة مخصصة', 'ملاحظات', 'الموظف', 'تاريخ ووقت التسجيل',
  ]
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`
  const blob = new Blob(['﻿' + [header, ...rows].map((r) => r.map(q).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${riyadhDate()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const mealTypeInfo = (o) =>
  o.mealType === 'optional'
    ? { type: 'الوجبة الاختيارية', color: '#0369a1' }
    : o.mealType === 'custom'
      ? { type: 'وجبة مخصصة', color: '#7c3aed' }
      : { type: 'الوجبة الأساسية', color: '#065f46' }

const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; padding: 12mm; direction: rtl; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .card { background: white; border: 1.5px solid #d1d5db; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .card-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; color: white; }
  .dept { font-size: 11px; font-weight: bold; }
  .meal-type-badge { font-size: 9px; background: rgba(255,255,255,0.25); padding: 2px 6px; border-radius: 10px; }
  .card-body { padding: 10px; }
  .patient-name { font-size: 16px; font-weight: bold; color: #111; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .info-row { display: flex; align-items: center; font-size: 11px; color: #374151; margin-bottom: 4px; flex-wrap: wrap; gap: 2px; }
  .info-row.small { font-size: 10px; color: #6b7280; }
  .info-label { color: #9ca3af; margin-left: 3px; }
  .info-val { font-weight: bold; color: #111; }
  .bed-badge { display: inline-block; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; padding: 0 6px; font-size: 13px; font-weight: bold; }
  .meal-box { background: #f9fafb; border-radius: 6px; padding: 8px 10px; margin: 6px 0; border-right: 3px solid currentColor; }
  .meal-type-label { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; opacity: 0.8; }
  .meal-name { font-size: 15px; font-weight: bold; color: #111; }
  .notes { color: #ef4444; font-style: italic; }
  .footer { font-size: 9px; color: #9ca3af; margin-top: 6px; border-top: 1px solid #f3f4f6; padding-top: 5px; }
  @media print {
    body { background: white; padding: 8mm; }
    .grid { gap: 4mm; }
    .card { border-color: #ccc; }
    @page { size: A4; margin: 8mm; }
  }`

export function printOrderCards(orders, deptById) {
  const e = escapeHtml
  const cards = orders
    .map((o) => {
      const { type, color } = mealTypeInfo(o)
      const day = o.day ? DAY_BY_ID[o.day]?.name || o.day : ''
      return `
    <div class="card">
      <div class="card-header" style="background:${color}">
        <span class="dept">${e(deptName(deptById, o.department))}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="meal-type-badge">${type}</span>
          <img src="/qhc-logo.jpeg" style="width:22px;height:22px;border-radius:4px;object-fit:cover;opacity:0.85" />
        </div>
      </div>
      <div class="card-body">
        <div class="patient-name">${e(o.patientName || 'بدون اسم')}</div>
        <div class="info-row">
          <span class="info-label">النوع:</span>
          <span>${e(personTypeName(o.personType))}</span>
        </div>
        <div class="info-row">
          <span class="info-label">غرفة:</span>
          <span class="info-val">${e(o.room)}</span>
          <span class="info-label" style="margin-right:8px">سرير:</span>
          <span class="info-val bed-badge">${e(bedLabel(o.bed))}</span>
        </div>
        <div class="meal-box">
          <div class="meal-type-label" style="color:${color}">${type}</div>
          <div class="meal-name">${e(o.mainMeal)}</div>
        </div>
        <div class="info-row small">
          <span>${e(MEAL_TIME_BY_ID[o.mealTime]?.name || o.mealTime)}</span>
          ${day ? `<span> · ${e(day)}</span>` : ''}
          ${o.notes ? `<span class="notes"> · ${e(o.notes)}</span>` : ''}
        </div>
        <div class="footer">${e(fmtDate(o.createdAt))} · ${e(o.createdByName || o.createdBy)}</div>
      </div>
    </div>`
    })
    .join('')
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>بطاقات الوجبات</title>
<style>${PRINT_CSS}
</style>
</head>
<body>
  <div class="grid">${cards}</div>
  <script>window.onload = () => { window.print() }</script>
</body>
</html>`)
  w.document.close()
}

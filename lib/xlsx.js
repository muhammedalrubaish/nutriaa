import { safeFileName } from './fileName'
// Real .xlsx files in the browser (download and upload). exceljs is loaded on demand,
// so it only weighs on the pages and moments that actually need it.

async function loadExcel() {
  const mod = await import('exceljs')
  return mod.default || mod
}

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF081C44' } }

/** One right-to-left sheet with a styled, frozen header row. */
function addSheet(wb, { name, header, rows, widths = [] }) {
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] })
  ws.columns = header.map((h, i) => ({ header: h, width: widths[i] || 16 }))
  rows.forEach((r) => ws.addRow(r))
  const head = ws.getRow(1)
  head.height = 24
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = HEADER_FILL
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  return ws
}

/**
 * Builds and downloads a one-sheet workbook laid out right-to-left with a styled, frozen header.
 * `lists` adds dropdowns: [{ col: 2, values: ['a', 'b'] }] (1-based column), kept on a hidden sheet.
 */
export async function downloadXlsx({ fileName, sheetName, header, rows, widths = [], lists = [], blankRows = 0, extraSheets = [] }) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const ws = addSheet(wb, { name: sheetName, header, rows, widths })
  // More sheets after the first (e.g. the report's summary, meal ranking and staff counts).
  extraSheets.forEach((sh) => addSheet(wb, sh))

  if (lists.length) {
    const src = wb.addWorksheet('القوائم', { state: 'veryHidden' })
    const last = rows.length + 1 + blankRows
    lists.forEach(({ col, values }, i) => {
      values.forEach((v, r) => (src.getCell(r + 1, i + 1).value = v))
      const letter = src.getColumn(i + 1).letter
      for (let r = 2; r <= last; r++) {
        ws.getCell(r, col).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'القوائم'!$${letter}$1:$${letter}$${values.length}`],
          showErrorMessage: true,
          errorTitle: 'قيمة غير صحيحة',
          error: 'اختر من القائمة',
        }
      }
    })
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveFile(blob, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/**
 * Hands a generated file to the user. On iPhone/iPad a blob download opens a full-screen file
 * preview that, inside the home-screen app, has no way back to the app, so there the file goes
 * to the share sheet instead ("Save to Files", WhatsApp, Mail ...), which returns to the app.
 */
export async function saveFile(blob, rawName) {
  const fileName = safeFileName(rawName)
  const file = typeof File === 'function' ? new File([blob], fileName, { type: blob.type }) : null
  if (file && isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (err) {
      // Building the file can outlast the tap that asked for it; the browser then refuses to open
      // the share sheet without a fresh tap, so ask for one.
      if (err?.name === 'NotAllowedError') shareButton(file)
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoking right away can make the browser drop the file name; give the download a moment to start.
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

function shareButton(file) {
  const wrap = document.createElement('div')
  wrap.setAttribute('dir', 'rtl')
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55);font-family:Cairo,system-ui,sans-serif'
  wrap.innerHTML = `
    <div style="width:100%;max-width:360px;background:#fff;color:#0f172a;border-radius:16px;padding:20px;text-align:center">
      <div style="font-weight:bold;font-size:17px;margin-bottom:6px">الملف جاهز</div>
      <div data-name style="font-size:13px;color:#64748b;margin-bottom:16px;word-break:break-all"></div>
      <button data-act="share" style="width:100%;padding:12px;border:0;border-radius:12px;background:#0284c7;color:#fff;font:inherit;font-weight:bold;font-size:15px;margin-bottom:8px">حفظ / مشاركة الملف</button>
      <button data-act="close" style="width:100%;padding:12px;border:0;border-radius:12px;background:#e2e8f0;color:#0f172a;font:inherit;font-weight:bold;font-size:15px">إغلاق</button>
    </div>`
  wrap.querySelector("[data-name]").textContent = file.name
  const close = () => wrap.remove()
  wrap.querySelector('[data-act="close"]').addEventListener('click', close)
  wrap.querySelector('[data-act="share"]').addEventListener('click', () => {
    navigator.share({ files: [file] }).then(close, (err) => err?.name !== 'AbortError' && close())
  })
  document.body.appendChild(wrap)
}

/**
 * First worksheet of an uploaded .xlsx file as rows of display strings (header row included).
 * Each row array carries `rowNumber`: its real row number in Excel, so errors can point at the right line
 * even when blank rows were skipped.
 */
export async function readXlsxRows(file) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets.find((w) => w.state === 'visible') || wb.worksheets[0]
  if (!ws) return []
  const rows = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = []
    for (let c = 1; c <= ws.columnCount; c++) cells.push(String(row.getCell(c).text ?? '').trim())
    cells.rowNumber = row.number
    rows.push(cells)
  })
  return rows
}

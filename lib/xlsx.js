// Real .xlsx files in the browser (download and upload). exceljs is loaded on demand,
// so it only weighs on the pages and moments that actually need it.

async function loadExcel() {
  const mod = await import('exceljs')
  return mod.default || mod
}

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B518C' } }

/**
 * Builds and downloads a one-sheet workbook laid out right-to-left with a styled, frozen header.
 * `lists` adds dropdowns: [{ col: 2, values: ['a', 'b'] }] (1-based column), kept on a hidden sheet.
 */
export async function downloadXlsx({ fileName, sheetName, header, rows, widths = [], lists = [], blankRows = 0 }) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] })
  ws.columns = header.map((h, i) => ({ header: h, width: widths[i] || 16 }))
  rows.forEach((r) => ws.addRow(r))
  const head = ws.getRow(1)
  head.height = 24
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = HEADER_FILL
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

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
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoking right away can make the browser drop the file name; give the download a moment to start.
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

/** First worksheet of an uploaded .xlsx file as rows of display strings (header row included). */
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
    rows.push(cells)
  })
  return rows
}

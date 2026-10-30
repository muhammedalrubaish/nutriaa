import { useEffect, useState } from 'react'
import Head from 'next/head'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, FileUp, Info, Loader2, Upload } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { PageHeader } from '@/components/forms'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { PERMS } from '@/lib/roles'
import { DAY_BY_ID, MEAL_TIMES, PERSON_TYPES, WEEK_DAYS } from '@/lib/constants'
import { parseImport, parseRows } from '@/lib/importParser'
import { downloadXlsx, readXlsxRows } from '@/lib/xlsx'

const TEMPLATE_HEADER = [
  'اسم المريض/المرافق', 'القسم', 'رقم الغرفة', 'رقم السرير', 'نوع الشخص', 'اليوم', 'وقت الوجبة',
  'الوجبة الأساسية', 'الإضافة الاختيارية', 'ملاحظات',
]

// No sample rows: a forgotten example would be imported as a real meal. Dropdowns guide the input instead.
function downloadTemplate(departments) {
  return downloadXlsx({
    fileName: 'نموذج_استيراد_الوجبات',
    sheetName: 'الطلبات',
    header: TEMPLATE_HEADER,
    rows: [],
    blankRows: 500,
    widths: [26, 20, 12, 12, 12, 12, 13, 30, 22, 26],
    lists: [
      { col: 2, values: departments.map((d) => d.name) },
      { col: 4, values: [1, 2, 3, 4] },
      { col: 5, values: PERSON_TYPES.map((p) => p.name) },
      { col: 6, values: WEEK_DAYS.map((d) => d.name) },
      { col: 7, values: MEAL_TIMES.map((m) => m.name) },
    ],
  })
}

export default function Import() {
  const { user, loading } = useAuth({ requirePerm: PERMS.MANAGE_USERS })
  const { departments, byId } = useDepartments({ enabled: !!user })
  const [text, setText] = useState('')
  const [file, setFile] = useState(null) // { name, rows } of an uploaded workbook
  const [reading, setReading] = useState(false)
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  // Re-validate pasted or uploaded rows once the department list has loaded.
  useEffect(() => {
    if (file) setRows(parseRows(file.rows, departments))
    else if (text) setRows(parseImport(text, departments))
  }, [departments])

  if (loading || !user) return <Spinner />

  const onPaste = (v) => {
    setText(v)
    setFile(null)
    setRows(parseImport(v, departments))
    setResult(null)
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setResult(null)
    setReading(true)
    try {
      const cells = await readXlsxRows(f)
      setFile({ name: f.name, rows: cells })
      setText('')
      setRows(parseRows(cells, departments))
    } catch {
      setFile(null)
      setRows([])
      setResult({ error: 'تعذّر قراءة الملف. تأكد أنه ملف Excel بصيغة ‎.xlsx' })
    } finally {
      setReading(false)
    }
  }
  const valid = rows.filter((r) => r.valid)
  const invalidCount = rows.length - valid.length

  const doImport = async () => {
    if (!valid.length) return
    setBusy(true)
    setResult(null)
    try {
      const r = await fetch('/api/bulk-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: valid.map(({ errors, valid, ...o }) => o) }),
      })
      const d = await r.json()
      setResult(d)
      if (r.ok && d.failed === 0) {
        setText('')
        setFile(null)
        setRows([])
      }
    } catch {
      setResult({ error: 'خطأ في الاتصال بالخادم' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>استيراد بيانات Excel | قسم خدمات التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-nav space-y-6">
        <PageHeader icon={FileSpreadsheet} title="استيراد بيانات من Excel" subtitle="أنشئ طلبات وجبات دفعة واحدة من ملف Excel مُعبَّأ مسبقاً">
          <button
            onClick={() => downloadTemplate(departments)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors text-sm"
          >
            <Download size={17} />
            تحميل نموذج Excel
          </button>
        </PageHeader>

        <div className="card rounded-2xl p-5 flex gap-3">
          <Info size={18} className="text-sky-400 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-bold mb-2">طريقة الاستخدام:</p>
            <ol className="list-decimal list-inside space-y-1 muted">
              <li>حمّل النموذج (ملف ‎.xlsx) بالزر أعلاه وافتحه بـ Excel</li>
              <li>املأ الأسطر تحت العناوين؛ القسم والسرير والنوع واليوم ووقت الوجبة تُختار من قائمة منسدلة</li>
              <li>احفظ الملف ثم ارفعه بزر &quot;رفع ملف Excel&quot; أدناه (أو انسخ الخلايا والصقها)</li>
              <li>راجع المعاينة ثم اضغط &quot;استيراد&quot;</li>
            </ol>
          </div>
        </div>

        <div className="card rounded-2xl p-5 space-y-3">
          <label
            className={`flex items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed border-emerald-500/40 text-emerald-400 font-bold cursor-pointer hover:bg-emerald-500/5 transition-colors ${
              reading ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {reading ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} />}
            {reading ? 'جارٍ قراءة الملف...' : file ? `تم رفع: ${file.name} — اضغط لاختيار ملف آخر` : 'رفع ملف Excel (‎.xlsx)'}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onFile}
              className="hidden"
            />
          </label>
          <p className="text-center text-xs muted">أو</p>
          <label className="font-bold text-sm block">الصق بيانات Excel هنا:</label>
          <textarea
            value={text}
            onChange={(e) => onPaste(e.target.value)}
            placeholder={'الصق البيانات المنسوخة من Excel هنا (Ctrl+V) ...\n\nمثال للسطر الأول:\nاسم المريض/المرافق\tالقسم\tرقم الغرفة\tرقم السرير\t...'}
            rows={7}
            className="w-full field rounded-xl p-3 text-xs font-mono resize-y"
            dir="ltr"
          />
          {rows.length > 0 && (
            <p className="text-sm muted">
              تم تحليل <strong>{rows.length}</strong> صف — <span className="text-emerald-400">{valid.length} صالح للاستيراد</span>
              {invalidCount > 0 && (
                <>
                  , <span className="text-rose-400">{invalidCount} يحتوي أخطاء (لن يُستورد)</span>
                </>
              )}
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <div className="card rounded-2xl p-5 space-y-3">
            <h3 className="font-bold">معاينة البيانات ({rows.length} صف)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-right border-b border-white/10">
                    {['#', 'الاسم', 'القسم', 'الغرفة/السرير', 'النوع', 'اليوم', 'الوجبة', 'الإضافة', 'الحالة'].map((h) => (
                      <th key={h} className="py-2 px-3 muted font-medium text-xs whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-white/5 ${r.valid ? '' : 'bg-rose-500/5'}`}>
                      <td className="py-2 px-3 muted text-xs">{i + 1}</td>
                      <td className="py-2 px-3 font-medium">{r.patientName || <span className="muted">—</span>}</td>
                      <td className="py-2 px-3 text-xs">
                        {byId[r.department]?.name || <span className="text-rose-400">{r.department || '؟'}</span>}
                      </td>
                      <td className="py-2 px-3 text-xs font-mono">{r.room && r.bed ? `${r.room} / ${r.bed}` : <span className="muted">—</span>}</td>
                      <td className="py-2 px-3 text-xs">
                        {r.personType === 'patient' ? 'مريض' : r.personType === 'companion' ? 'مرافق' : <span className="text-rose-400">؟</span>}
                      </td>
                      <td className="py-2 px-3 text-xs">{DAY_BY_ID[r.day]?.name || <span className="text-rose-400">{r.day || '؟'}</span>}</td>
                      <td className="py-2 px-3 text-xs">{r.mainMeal || <span className="muted">—</span>}</td>
                      <td className="py-2 px-3 text-xs muted">{r.options?.[0] || '—'}</td>
                      <td className="py-2 px-3 text-xs">
                        {r.valid ? (
                          <span className="text-emerald-400 flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 size={13} /> صالح
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1 whitespace-nowrap cursor-help" title={r.errors.join('\n')}>
                            <AlertCircle size={13} /> {r.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div
            className={`rounded-2xl p-4 text-sm font-medium ${
              result.error
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {result.error ? (
              result.error
            ) : (
              <>
                تم استيراد <strong>{result.imported}</strong> طلب بنجاح
                {result.failed > 0 && (
                  <>
                    , فشل <strong>{result.failed}</strong>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {valid.length > 0 && (
          <button
            onClick={doImport}
            disabled={busy}
            className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {busy ? 'جارٍ الاستيراد...' : `استيراد ${valid.length} طلب`}
          </button>
        )}
      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import Head from 'next/head'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Info, Loader2, Upload } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { PageHeader } from '@/components/forms'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { PERMS } from '@/lib/roles'
import { DAY_BY_ID } from '@/lib/constants'
import { parseImport } from '@/lib/importParser'

const TEMPLATE_HEADER = [
  'اسم المريض/المرافق', 'القسم', 'رقم الغرفة', 'رقم السرير', 'نوع الشخص (مريض/مرافق)', 'اليوم',
  'وقت الوجبة (فطور/غداء/عشاء)', 'الوجبة الأساسية', 'الإضافة الاختيارية', 'ملاحظات',
]
const TEMPLATE_ROWS = [
  ['نورة عبدالله السالم', 'قسم الولادة ١', '128', '1', 'مريض', 'الأحد', 'غداء', 'وجبة عادية', 'عصير طازج', ''],
  ['فاطمة علي الزهراني', 'قسم الولادة ٢', '150', '2', 'مريض', 'الاثنين', 'فطور', 'وجبة دايت', 'فاكهة', 'بدون ملح'],
  ['هند سعد القحطاني', 'قسم الأرحام', '330', '1', 'مرافق', 'الثلاثاء', 'عشاء', 'وجبة مرضى السكري', '', ''],
]

function downloadTemplate() {
  const blob = new Blob(
    ['﻿' + [TEMPLATE_HEADER, ...TEMPLATE_ROWS].map((r) => r.map((c) => `"${c}"`).join(',')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'نموذج_استيراد_الوجبات.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function Import() {
  const { user, loading } = useAuth({ requirePerm: PERMS.MANAGE_USERS })
  const { departments, byId } = useDepartments({ enabled: !!user })
  const [text, setText] = useState('')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  // Re-validate pasted rows once the department list has loaded.
  useEffect(() => {
    if (text) setRows(parseImport(text, departments))
  }, [departments])

  if (loading || !user) return <Spinner />

  const onPaste = (v) => {
    setText(v)
    setRows(parseImport(v, departments))
    setResult(null)
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
        <title>استيراد بيانات Excel | قسم التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <PageHeader icon={FileSpreadsheet} title="استيراد بيانات من Excel" subtitle="أنشئ طلبات وجبات دفعة واحدة من ملف Excel مُعبَّأ مسبقاً">
          <button
            onClick={downloadTemplate}
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
              <li>حمّل نموذج Excel بالضغط على الزر أعلاه ثم افتحه بـ Excel</li>
              <li>أدخل بيانات الوجبات في الأسطر بعد السطر الأول (السطر الأول عناوين لا تحذفه)</li>
              <li>
                اختر كل الخلايا <span className="font-mono bg-white/10 px-1 rounded">Ctrl+A</span> ثم انسخ{' '}
                <span className="font-mono bg-white/10 px-1 rounded">Ctrl+C</span>
              </li>
              <li>الصق البيانات في الحقل أدناه وراجع المعاينة</li>
              <li>اضغط &quot;استيراد&quot; لإنشاء الطلبات في النظام</li>
            </ol>
          </div>
        </div>

        <div className="card rounded-2xl p-5 space-y-3">
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

import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { AlertTriangle, CalendarDays, Coffee, Download, FileSpreadsheet, Library, Save, Search, Upload, Utensils, X } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import MealLibraryManager from '@/components/MealLibraryManager'
import { useAuth } from '@/lib/useAuth'
import { can, PERMS } from '@/lib/roles'
import { APP_TITLE, WEEK_DAYS } from '@/lib/constants'
import { mealPickerNames } from '@/lib/mealLibrary'
import { MENU_TEMPLATE_HEADER, optionalsWithoutMain, parseMenuSheet } from '@/lib/menuImport'
import { downloadXlsx, readXlsxRows } from '@/lib/xlsx'
import { useLive } from '@/lib/useLive'

const OPT_FIELDS = [
  { key: 'optionalItem', label: 'الوجبة الاختيارية 1' },
  { key: 'optionalItem2', label: 'الوجبة الاختيارية 2' },
  { key: 'optionalItem3', label: 'الوجبة الاختيارية 3' },
]

export default function Menu() {
  const { user, loading } = useAuth({ requirePerm: PERMS.CREATE_ORDERS })
  const [menu, setMenu] = useState(null)
  const [saved, setSaved] = useState(null) // the menu as last loaded/saved (for the «day loses its main meal» check)
  const [library, setLibrary] = useState([])
  const [hiddenMeals, setHiddenMeals] = useState([])
  const [manageOpen, setManageOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null) // note 9: { draft, errors, days, fileName }
  const [dirty, setDirty] = useState(false)
  const fileRef = useRef(null)
  const editable = can(user?.role, PERMS.EDIT_MENU)

  const loadMenu = () =>
    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => {
        setMenu(d.menu)
        setSaved(d.menu)
      })
      .catch(() => {})
  const loadLibrary = () =>
    fetch('/api/meals')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setLibrary(d.meals || [])
        setHiddenMeals(d.hidden || [])
      })
      .catch(() => {})

  useEffect(() => {
    if (!user) return
    loadMenu()
    if (editable) loadLibrary()
  }, [user])
  // Someone else's menu edit shows up live, unless this user has unsaved edits on screen (note 10).
  useLive(() => !dirty && loadMenu(), !!user)

  // Active library names, plus fixed-list names the library has never stored (hidden ones stay out).
  const names = useMemo(() => mealPickerNames(library, hiddenMeals), [library, hiddenMeals])

  if (loading || !user || !menu) return <Spinner />

  const set = (day, k, v) => {
    setDirty(true)
    setMenu((m) => ({ ...m, [day]: { ...m[day], [k]: v } }))
  }

  const save = async (data = menu) => {
    setError('')
    const noMain = WEEK_DAYS.filter((d) => !(data[d.id]?.mainMeal || '').trim())
    const optNoMain = noMain.filter((d) => OPT_FIELDS.some((f) => (data[d.id]?.[f.key] || '').trim()))
    if (optNoMain.length) return setError(`لا يمكن حفظ وجبات اختيارية بدون وجبة أساسية: ${optNoMain.map((d) => d.name).join('، ')}`)
    // A day losing its main meal blocks order entry for that day, so ask first. Days that were already
    // empty (e.g. Friday/Saturday) do not ask again, so an unchanged menu or template saves directly.
    const lost = noMain.filter((d) => (saved?.[d.id]?.mainMeal || '').trim())
    if (lost.length && !confirm(`الأيام التالية ستصبح بدون وجبة أساسية ولن يمكن إدخال طلبات لها:\n${lost.map((d) => d.name).join('، ')}\n\nهل تريد الحفظ؟`)) return
    setStatus('saving')
    try {
      const r = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: data }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error || 'تعذّر حفظ القائمة')
        return setStatus('idle')
      }
      setMenu(d.menu)
      setSaved(d.menu)
      setDirty(false)
      setPreview(null)
      loadLibrary()
      // 'notified': something actually changed, so staff got an alert; 'saved': nothing to announce.
      setStatus(d.changed?.length ? 'notified' : 'saved')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setError('خطأ في الاتصال بالشبكة')
      setStatus('idle')
    }
  }

  const downloadTemplate = () =>
    downloadXlsx({
      fileName: 'نموذج-القائمة-الأسبوعية',
      sheetName: 'القائمة الأسبوعية',
      header: MENU_TEMPLATE_HEADER,
      widths: [14, 30, 26, 26, 26],
      rows: WEEK_DAYS.map((d) => [d.name, menu[d.id]?.mainMeal || '', ...OPT_FIELDS.map((f) => menu[d.id]?.[f.key] || '')]),
    })

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const rows = await readXlsxRows(file)
      setPreview({ ...parseMenuSheet(rows, menu), fileName: file.name })
    } catch {
      setError('تعذّر قراءة الملف — تأكد أنه ملف Excel (.xlsx)')
    }
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>القائمة الأسبوعية | {APP_TITLE}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-600/15 text-emerald-500 rounded-xl flex items-center justify-center">
              <CalendarDays size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">القائمة الأسبوعية</h2>
              <p className="text-sm muted">لكل يوم وجبة أساسية واحدة وحتى 3 وجبات اختيارية</p>
            </div>
          </div>
          {editable && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setManageOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold card-2 hover:border-emerald-500/40">
                <Library size={18} /> إدارة الوجبات
              </button>
              <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold card-2 hover:border-emerald-500/40">
                <Download size={18} /> نموذج Excel
              </button>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold card-2 hover:border-emerald-500/40">
                <Upload size={18} /> استيراد من Excel
              </button>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onFile} />
              <button
                onClick={() => save()}
                disabled={status === 'saving'}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-colors ${
                  status === 'saved' || status === 'notified' ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <Save size={18} />
                {status === 'saving'
                  ? 'جارٍ الحفظ...'
                  : status === 'notified'
                    ? 'تم الحفظ وتنبيه الموظفين'
                    : status === 'saved'
                      ? 'لا توجد تغييرات'
                      : 'حفظ القائمة'}
              </button>
            </div>
          )}
        </div>
        {error && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</div>}

        {preview && (
          <ImportPreview
            preview={preview}
            current={menu}
            saving={status === 'saving'}
            onCancel={() => setPreview(null)}
            onSave={() => save(preview.draft)}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEK_DAYS.map((d) => {
            const m = menu[d.id] || {}
            const noMain = !(m.mainMeal || '').trim()
            return (
              <div key={d.id} className="card rounded-3xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-600/15 text-emerald-500 flex items-center justify-center text-sm font-bold">
                    {d.name[0] === 'ا' ? d.name[2] : d.name[0]}
                  </span>
                  <h3 className="font-bold">{d.name}</h3>
                  {noMain && (
                    <span className="mr-auto text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={12} /> بدون وجبة أساسية
                    </span>
                  )}
                </div>
                <MenuField
                  icon={<Utensils size={12} className="text-green-600" />}
                  label=" الوجبة الأساسية"
                  editable={editable}
                  options={names.main}
                  value={m.mainMeal || ''}
                  onChange={(v) => set(d.id, 'mainMeal', v)}
                />
                {OPT_FIELDS.map((f) => (
                  <MenuField
                    key={f.key}
                    icon={<Coffee size={12} className="text-sky-500" />}
                    label={' ' + f.label}
                    editable={editable}
                    options={names.optional}
                    value={m[f.key] || ''}
                    onChange={(v) => set(d.id, f.key, v)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </main>
      {manageOpen && (
        <MealLibraryManager
          meals={library}
          onChange={loadLibrary}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  )
}

/** Note 9: what the file will change, before anything is saved. Errors (with real Excel row numbers) block saving. */
function ImportPreview({ preview, current, saving, onCancel, onSave }) {
  const { draft, errors, days, fileName } = preview
  return (
    <section className="card rounded-3xl p-5 space-y-4 border-2 !border-sky-500/40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-sky-500" />
          <h3 className="font-bold">معاينة الاستيراد</h3>
          <span className="text-xs muted truncate max-w-[50vw]">{fileName}</span>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg muted hover:text-rose-500" title="إلغاء">
          <X size={18} />
        </button>
      </div>
      {errors.length > 0 && (
        <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 space-y-1">
          <b className="block">لا يمكن الحفظ حتى تُصحَّح هذه الأخطاء في الملف:</b>
          {errors.map((e) => (
            <p key={e}>• {e}</p>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-token">
        <table className="w-full text-sm">
          <thead className="card-2">
            <tr className="text-right">
              <th className="p-2">اليوم</th>
              <th className="p-2">الوجبة الأساسية</th>
              <th className="p-2">الاختيارية 1</th>
              <th className="p-2">الاختيارية 2</th>
              <th className="p-2">الاختيارية 3</th>
            </tr>
          </thead>
          <tbody>
            {WEEK_DAYS.filter((d) => days.includes(d.id)).map((d) => {
              const m = draft[d.id] || {}
              const c = current[d.id] || {}
              // QA round 2: same rule as saving — an empty day (e.g. Friday/Saturday) is allowed and shown
              // as «لا توجد وجبات»; «— مطلوبة —» in red only where saving is blocked (optionals, no main).
              const blocked = optionalsWithoutMain(m)
              const cell = (k) => (
                <td className={`p-2 ${(m[k] || '') !== (c[k] || '') ? 'font-bold text-sky-600 dark:text-sky-400' : ''}`}>
                  {m[k] ||
                    (k !== 'mainMeal' ? '—' : blocked ? <span className="text-rose-500">— مطلوبة —</span> : <span className="muted font-normal">لا توجد وجبات</span>)}
                </td>
              )
              return (
                <tr key={d.id} className="border-t border-token">
                  <td className="p-2 font-bold">{d.name}</td>
                  {cell('mainMeal')}
                  {cell('optionalItem')}
                  {cell('optionalItem2')}
                  {cell('optionalItem3')}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs muted">الخلايا الملوّنة تختلف عن القائمة الحالية. الأيام غير الموجودة في الملف تبقى كما هي.</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl card-2 font-bold">
          إلغاء
        </button>
        <button
          onClick={onSave}
          disabled={errors.length > 0 || saving}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ القائمة المستوردة'}
        </button>
      </div>
    </section>
  )
}

/** Note 8: a searchable picker over the meal library; free text is still allowed (it joins the library on save). */
function MenuField({ icon, label, editable, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])
  const q = value.trim().toLowerCase()
  const list = (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 40)
  return (
    <div className="space-y-1.5">
      <label className="text-xs muted flex items-center gap-1">
        {icon}
        {label}
      </label>
      {editable ? (
        <div className="relative" ref={ref}>
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 muted pointer-events-none" />
          <input
            type="text"
            value={value}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onChange(e.target.value)
              setOpen(true)
            }}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="ابحث أو اكتب..."
            className="w-full field rounded-xl p-2.5 pr-8 pl-8 text-sm"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-1/2 -translate-y-1/2 left-2 muted hover:text-rose-500"
              title="مسح"
            >
              <X size={14} />
            </button>
          )}
          {open && list.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto card rounded-xl shadow-xl text-sm" role="listbox">
              {list.map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o)
                      setOpen(false)
                    }}
                    className={`w-full text-right px-3 py-2 hover:bg-sky-500/10 ${o === value ? 'font-bold text-sky-500' : ''}`}
                  >
                    {o}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="card-2 rounded-xl p-2.5 text-sm font-medium">{value || '—'}</p>
      )}
    </div>
  )
}

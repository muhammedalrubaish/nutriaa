import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { AlertTriangle, CheckCircle, ClipboardEdit, Coffee, PenLine, Utensils } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import BedMap from '@/components/BedMap'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { PERMS } from '@/lib/roles'
import { MEAL_TIMES, WEEK_DAYS } from '@/lib/constants'
import { useLive } from '@/lib/useLive'

const OPTIONAL_SLOTS = [
  { id: 'opt1', key: 'optionalItem' },
  { id: 'opt2', key: 'optionalItem2' },
  { id: 'opt3', key: 'optionalItem3' },
]

/** One submit key per order being entered (note 7): a double tap or a retry never saves it twice. */
function newSubmitKey() {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return 'o_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

const EMPTY = {
  department: '',
  room: '',
  bed: '',
  patientName: '',
  personType: 'patient',
  day: '',
  mealTime: 'lunch',
  mealChoice: '',
  customMeal: '',
  notes: '',
}

// Department toggles keep production's 4-column look and adapt to the number of departments.
const DEPT_GRID = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

export default function Orders() {
  const { user, loading } = useAuth({ requirePerm: PERMS.CREATE_ORDERS })
  const { departments, byId } = useDepartments({ enabled: !!user })
  const [form, setForm] = useState(EMPTY)
  const [menu, setMenu] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState('')
  // Button lock (note 7): set synchronously, so a second tap before React re-renders is ignored.
  const busy = useRef(false)
  // Submit key for the order on screen; kept across retries of the same content, renewed after a save.
  const submitKey = useRef({ key: null, sig: '' })

  const loadMenu = () =>
    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => setMenu(d.menu))
      .catch(() => {})
  useEffect(() => {
    if (user) loadMenu()
  }, [user])
  // A menu edit elsewhere shows up here within seconds (note 10).
  useLive(loadMenu, !!user)

  if (loading || !user) return <Spinner />

  const dept = byId[form.department]
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const dayMenu = form.day && menu ? menu[form.day] : null
  // Note 6: up to three optional meals per day; optional and custom need a main meal on that day's menu.
  const optionals = OPTIONAL_SLOTS.map((o) => ({ ...o, name: dayMenu?.[o.key] || '' })).filter((o) => o.name)
  const noMain = !!form.day && !!menu && !dayMenu?.mainMeal
  const optSlot = OPTIONAL_SLOTS.find((o) => o.id === form.mealChoice)
  const resolvedMeal =
    form.mealChoice === 'main'
      ? dayMenu?.mainMeal
      : optSlot
        ? dayMenu?.[optSlot.key]
        : form.mealChoice === 'custom'
          ? form.customMeal.trim()
          : null
  const mealType = form.mealChoice === 'main' ? 'main' : optSlot ? 'optional' : form.mealChoice === 'custom' ? 'custom' : ''

  const submit = async (e) => {
    e.preventDefault()
    if (busy.current) return
    setError('')
    setDuplicate('')
    if (!form.day) return setError('الرجاء اختيار اليوم')
    if (noMain) return setError('لا توجد وجبة أساسية لهذا اليوم في القائمة — لا يمكن إدخال طلب له')
    if (!form.department || !form.room || !form.bed) return setError('الرجاء تعبئة القسم والغرفة والسرير')
    if (!form.patientName.trim()) return setError('الرجاء كتابة الاسم')
    if (!form.mealChoice) return setError('الرجاء اختيار الوجبة')
    if (form.mealChoice === 'custom' && !form.customMeal.trim()) return setError('الرجاء كتابة اسم الوجبة المخصصة')
    const payload = {
      department: form.department,
      room: form.room,
      bed: form.bed,
      patientName: form.patientName.trim(),
      personType: form.personType,
      day: form.day,
      mealTime: form.mealTime,
      mainMeal: resolvedMeal,
      mealType,
      options: [],
      notes: form.notes,
    }
    const sig = JSON.stringify(payload)
    if (submitKey.current.sig !== sig || !submitKey.current.key) submitKey.current = { key: newSubmitKey(), sig }
    busy.current = true
    setStatus('sending')
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, id: submitKey.current.key }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        submitKey.current = { key: null, sig: '' }
        setStatus('success')
        setForm((f) => ({
          ...EMPTY,
          department: f.department,
          room: f.room,
          bed: f.bed,
          personType: f.personType,
          day: f.day,
          mealTime: f.mealTime,
        }))
        setTimeout(() => setStatus('idle'), 2000)
      } else if (r.status === 409) {
        // Already registered: who entered it and when (note 7).
        setDuplicate(d?.error || 'هذا الطلب مسجّل مسبقًا')
        setStatus('idle')
      } else {
        setError(d?.error || 'تعذّر حفظ الطلب')
        setStatus('idle')
      }
    } catch {
      // The same submit key is reused on retry, so a request that did reach the server is not saved twice.
      setError('خطأ في الاتصال بالشبكة — أعد المحاولة')
      setStatus('idle')
    } finally {
      busy.current = false
    }
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>إدخال طلب | قسم خدمات التغذية - نيوتريا</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-600/15 text-emerald-500 rounded-xl flex items-center justify-center">
            <ClipboardEdit size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">إدخال طلب وجبة</h2>
            <p className="text-sm muted">للمريض أو المرافق</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <section className="card rounded-3xl p-6 space-y-5">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">الخطوة ١ — البيانات</p>
            <Field label="اليوم">
              <div className="grid grid-cols-7 gap-1">
                {WEEK_DAYS.map((d) => (
                  <Toggle key={d.id} compact active={form.day === d.id} onClick={() => setForm((f) => ({ ...f, day: d.id, mealChoice: '' }))}>
                    {d.name}
                  </Toggle>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="الاسم">
                <input
                  value={form.patientName}
                  onChange={(e) => set('patientName', e.target.value)}
                  placeholder="اكتب الاسم..."
                  className="w-full field rounded-xl p-3"
                />
              </Field>
              <Field label="النوع">
                <div className="grid grid-cols-2 gap-2">
                  <Toggle active={form.personType === 'patient'} onClick={() => set('personType', 'patient')}>
                    مريض
                  </Toggle>
                  <Toggle active={form.personType === 'companion'} onClick={() => set('personType', 'companion')}>
                    مرافق
                  </Toggle>
                </div>
              </Field>
            </div>
            <Field label="القسم">
              <div className={`grid ${DEPT_GRID[departments.length] || 'grid-cols-3 sm:grid-cols-4'} gap-1.5`}>
                {departments.map((d) => (
                  <Toggle
                    key={d.id}
                    compact
                    active={form.department === d.id}
                    onClick={() => setForm((f) => ({ ...f, department: d.id, room: '' }))}
                  >
                    {d.name}
                  </Toggle>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="رقم الغرفة">
                <select
                  value={form.room}
                  onChange={(e) => set('room', e.target.value)}
                  disabled={!dept}
                  className="w-full h-12 field rounded-xl px-3 disabled:opacity-50"
                >
                  <option value="">{dept ? 'اختر الغرفة' : 'اختر القسم أولاً'}</option>
                  {dept?.rooms.map((n) => (
                    <option key={n} value={n}>
                      غرفة {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="وقت الوجبة">
                {/* Same height as the room select next to it. */}
                <div className="grid grid-cols-3 gap-1.5">
                  {MEAL_TIMES.map((m) => (
                    <Toggle key={m.id} className="h-12 px-1 text-sm" active={form.mealTime === m.id} onClick={() => set('mealTime', m.id)}>
                      {m.name}
                    </Toggle>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="السرير">
              <BedMap selected={Number(form.bed)} onSelect={(n) => set('bed', n)} />
            </Field>
          </section>

          <section className="card rounded-3xl p-6 space-y-4">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">الخطوة ٢ — اختيار الوجبة</p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => set('mealChoice', 'main')}
                  disabled={!dayMenu?.mainMeal}
                  className={`relative text-right rounded-2xl p-5 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    form.mealChoice === 'main' ? 'border-green-600 bg-green-600/10' : 'border-transparent card-2 hover:border-green-600/40'
                  }`}
                >
                  {form.mealChoice === 'main' && <CheckCircle size={18} className="absolute top-4 left-4 text-green-600" />}
                  <div className="flex items-center gap-2 mb-2">
                    <Utensils size={18} className="text-green-600" />
                    <span className="text-xs font-bold text-green-600">الوجبة الأساسية</span>
                  </div>
                  <p className="text-lg font-bold">{dayMenu?.mainMeal || (form.day ? 'غير محددة' : 'اختر اليوم أولاً')}</p>
                </button>
                {optionals.length === 0 ? (
                  <div className="rounded-2xl p-5 border-2 border-transparent card-2 opacity-40">
                    <div className="flex items-center gap-2 mb-2">
                      <Coffee size={18} className="text-sky-500" />
                      <span className="text-xs font-bold text-sky-500">الوجبات الاختيارية</span>
                    </div>
                    <p className="text-lg font-bold">لا توجد وجبة اختيارية</p>
                  </div>
                ) : (
                  optionals.map((o, i) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => !noMain && set('mealChoice', o.id)}
                      disabled={noMain}
                      className={`relative text-right rounded-2xl p-5 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        form.mealChoice === o.id ? 'border-sky-500 bg-sky-500/10' : 'border-transparent card-2 hover:border-sky-500/40'
                      }`}
                    >
                      {form.mealChoice === o.id && <CheckCircle size={18} className="absolute top-4 left-4 text-sky-500" />}
                      <div className="flex items-center gap-2 mb-2">
                        <Coffee size={18} className="text-sky-500" />
                        <span className="text-xs font-bold text-sky-500">
                          الوجبة الاختيارية{optionals.length > 1 ? ` ${i + 1}` : ''}
                        </span>
                      </div>
                      <p className="text-lg font-bold">{o.name}</p>
                    </button>
                  ))
                )}
              </div>
              {noMain && (
                <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2 items-start">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  لا توجد وجبة أساسية لهذا اليوم في القائمة الأسبوعية، لذلك لا يمكن إدخال طلب له. اطلب من المشرف تحديث القائمة.
                </div>
              )}
              <button
                type="button"
                onClick={() => !noMain && set('mealChoice', 'custom')}
                disabled={noMain}
                className={`w-full text-right rounded-2xl p-4 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  form.mealChoice === 'custom' ? 'border-violet-500 bg-violet-500/10' : 'border-transparent card-2 hover:border-violet-500/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  {form.mealChoice === 'custom' ? (
                    <CheckCircle size={18} className="text-violet-500 shrink-0" />
                  ) : (
                    <PenLine size={18} className="text-violet-400 shrink-0" />
                  )}
                  <span className="text-sm font-bold text-violet-400">وجبة مخصصة — اكتب من عندك</span>
                </div>
              </button>
              {form.mealChoice === 'custom' && (
                <input
                  autoFocus
                  value={form.customMeal}
                  onChange={(e) => set('customMeal', e.target.value)}
                  placeholder="اكتب اسم الوجبة..."
                  className="w-full field rounded-xl p-3 text-base"
                />
              )}
            </div>
          </section>

          <section className="card rounded-3xl p-6 space-y-4">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">الخطوة ٣ — حفظ</p>
            <Field label="ملاحظات (اختياري)">
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                placeholder="حساسية، بدون ملح، طلب خاص..."
                className="w-full field rounded-xl p-3 resize-none"
              />
            </Field>
            {error && (
              <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">{error}</div>
            )}
            {duplicate && (
              <div role="alert" className="text-sm text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 flex gap-2 items-start">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <span>
                  <b className="block">طلب مكرر — لم يُحفظ</b>
                  {duplicate}
                </span>
              </div>
            )}
            <button
              disabled={status === 'sending' || noMain}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 text-white transition-colors ${
                status === 'success' ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60'
              }`}
            >
              {status === 'sending' ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : status === 'success' ? (
                <>
                  <CheckCircle size={22} /> تم الحفظ
                </>
              ) : (
                'حفظ الطلب'
              )}
            </button>
          </section>
        </form>
      </main>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium muted">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ active, onClick, children, compact, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border transition-colors text-center ${
        className || (compact ? 'py-2 px-1 text-xs leading-tight' : 'py-3 px-4 text-sm')
      } ${
        active ? 'bg-emerald-600 border-emerald-500 text-white font-bold' : 'card-2 hover:border-emerald-500/40'
      }`}
    >
      {children}
    </button>
  )
}

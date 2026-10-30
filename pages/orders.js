import { useEffect, useState } from 'react'
import Head from 'next/head'
import { CheckCircle, ClipboardEdit, Coffee, PenLine, Utensils } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import BedMap from '@/components/BedMap'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { PERMS } from '@/lib/roles'
import { MEAL_TIMES, WEEK_DAYS } from '@/lib/constants'

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

  useEffect(() => {
    if (!user) return
    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => setMenu(d.menu))
      .catch(() => {})
  }, [user])

  if (loading || !user) return <Spinner />

  const dept = byId[form.department]
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const dayMenu = form.day && menu ? menu[form.day] : null
  const hasOptional = !!dayMenu?.optionalItem
  const resolvedMeal =
    form.mealChoice === 'main'
      ? dayMenu?.mainMeal
      : form.mealChoice === 'optional'
        ? dayMenu?.optionalItem
        : form.mealChoice === 'custom'
          ? form.customMeal.trim()
          : null

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.day) return setError('الرجاء اختيار اليوم')
    if (!form.department || !form.room || !form.bed) return setError('الرجاء تعبئة القسم والغرفة والسرير')
    if (!form.patientName.trim()) return setError('الرجاء كتابة الاسم')
    if (!form.mealChoice) return setError('الرجاء اختيار الوجبة')
    if (form.mealChoice === 'custom' && !form.customMeal.trim()) return setError('الرجاء كتابة اسم الوجبة المخصصة')
    setStatus('sending')
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: form.department,
          room: form.room,
          bed: form.bed,
          patientName: form.patientName,
          personType: form.personType,
          day: form.day,
          mealTime: form.mealTime,
          mainMeal: resolvedMeal,
          mealType: form.mealChoice,
          options: [],
          notes: form.notes,
        }),
      })
      const d = await r.json()
      if (r.ok) {
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
      } else {
        setError(d?.error || 'تعذّر حفظ الطلب')
        setStatus('idle')
      }
    } catch {
      setError('خطأ في الاتصال بالشبكة')
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>إدخال طلب | قسم خدمات التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-nav space-y-5">
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
                    form.mealChoice === 'main' ? 'border-emerald-500 bg-emerald-500/10' : 'border-transparent card-2 hover:border-emerald-500/40'
                  }`}
                >
                  {form.mealChoice === 'main' && <CheckCircle size={18} className="absolute top-4 left-4 text-emerald-500" />}
                  <div className="flex items-center gap-2 mb-2">
                    <Utensils size={18} className="text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-500">الوجبة الأساسية</span>
                  </div>
                  <p className="text-lg font-bold">{dayMenu?.mainMeal || (form.day ? 'غير محددة' : 'اختر اليوم أولاً')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => hasOptional && set('mealChoice', 'optional')}
                  disabled={!hasOptional}
                  className={`relative text-right rounded-2xl p-5 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    form.mealChoice === 'optional' ? 'border-sky-500 bg-sky-500/10' : 'border-transparent card-2 hover:border-sky-500/40'
                  }`}
                >
                  {form.mealChoice === 'optional' && <CheckCircle size={18} className="absolute top-4 left-4 text-sky-500" />}
                  <div className="flex items-center gap-2 mb-2">
                    <Coffee size={18} className="text-sky-500" />
                    <span className="text-xs font-bold text-sky-500">الوجبة الاختيارية</span>
                  </div>
                  <p className="text-lg font-bold">{dayMenu?.optionalItem || 'لا توجد وجبة اختيارية'}</p>
                </button>
              </div>
              <button
                type="button"
                onClick={() => set('mealChoice', 'custom')}
                className={`w-full text-right rounded-2xl p-4 border-2 transition-all ${
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
            <button
              disabled={status === 'sending'}
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

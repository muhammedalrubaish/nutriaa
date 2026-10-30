import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle, BarChart3, CalendarDays, ChevronLeft, Clock, Download, Filter, Send, User, UserPlus, Users, X,
} from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { can, PERMS } from '@/lib/roles'
import { MEAL_TIME_BY_ID, bedLabel, personTypeName } from '@/lib/constants'
import { colorClasses } from '@/lib/departments'
import { fmtDate, timeAgo } from '@/lib/format'
import { exportOrdersXlsx } from '@/lib/export'
import { monthStart, riyadhDate, weekStart } from '@/lib/time'

const PERIODS = [
  { id: 'today', name: 'يومي' },
  { id: 'week', name: 'أسبوعي' },
  { id: 'month', name: 'شهري' },
  { id: 'custom', name: 'فترة محددة' },
]

/** { from, to, label } for the chosen period, in Riyadh dates. */
function periodRange(period, custom) {
  const today = riyadhDate()
  if (period === 'week') return { from: weekStart(today), to: today, label: 'هذا الأسبوع' }
  if (period === 'month') return { from: monthStart(today), to: today, label: 'هذا الشهر' }
  if (period === 'custom' && custom.from && custom.to) {
    const [from, to] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from]
    return { from, to, label: from === to ? from : `من ${from} إلى ${to}` }
  }
  return { from: today, to: today, label: 'اليوم' }
}

function rangeQuery({ from, to }, user, extra = {}) {
  const p = new URLSearchParams({ from, to, ...extra })
  if (user) p.set('user', user)
  return p.toString()
}

const TREND_TITLE = { hour: 'حسب الساعة', day: 'حسب اليوم', week: 'حسب الأسبوع', month: 'حسب الشهر' }
const trendLabel = (unit, key) => (unit === 'hour' ? key.padStart(2, '0') : unit === 'month' ? key : key.slice(5))

export default function Dashboard() {
  const { user, loading } = useAuth({ requirePerm: PERMS.VIEW_REPORTS })
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [openDept, setOpenDept] = useState(null)
  const [period, setPeriod] = useState('today')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [userFilter, setUserFilter] = useState('')
  const { byId: deptById } = useDepartments({ all: true, enabled: !!user })

  const range = periodRange(period, custom)
  const qs = rangeQuery(range, userFilter)

  useEffect(() => {
    if (!user) return
    let alive = true
    const load = () =>
      fetch('/api/stats?' + qs)
        .then(async (r) => {
          const d = await r.json()
          if (!alive) return
          if (r.ok) {
            setStats(d)
            setError('')
          } else setError(d.error || 'تعذّر تحميل المؤشرات')
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [user, qs])

  if (loading || !user) return <Spinner />

  const sum = stats?.summary || { total: 0, patient: 0, companion: 0, avgDaily: 0 }
  const points = stats?.trend?.points || []
  const unit = stats?.trend?.unit || 'hour'
  const maxTrend = Math.max(1, ...points.map((t) => t.count))
  const labelStep = Math.ceil(points.length / 8)
  const person = stats?.byPersonType || { patient: 0, companion: 0 }
  const byUser = stats?.byUser || []
  const maxUser = Math.max(1, ...byUser.map((u) => u.total))
  const canExport = can(user.role, PERMS.EXPORT_REPORTS)
  const canNotes = can(user.role, PERMS.SEND_NOTES)
  const userName = (stats?.users || []).find((u) => u.username === userFilter)?.name || userFilter
  const scope = `${range.label}${userFilter ? ` · ${userName}` : ''}`
  // Expected volume for the period, so the department bars stay comparable across periods.
  const deptTarget = (stats?.minDaily || 5) * (stats?.days || 1)

  const exportRange = async () => {
    const r = await fetch('/api/orders?' + qs)
    const d = await r.json()
    const name = range.from === range.to ? `تقرير-${range.from}` : `تقرير-${range.from}_${range.to}`
    exportOrdersXlsx(d.orders || [], deptById, userFilter ? `${name}-${userFilter}` : name)
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>لوحة المؤشرات | قسم خدمات التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-nav space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">لوحة المؤشرات</h2>
            <p className="text-sm muted mt-1">ملخص طلبات الوجبات — {scope}</p>
          </div>
          {canExport && (
            <button
              onClick={exportRange}
              disabled={!sum.total}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              <Download size={18} /> تصدير تقرير الفترة
            </button>
          )}
        </div>

        <section className="card rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm muted">
            <Filter size={16} /> تصفية المؤشرات
          </div>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl card-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriod(p.id)
                  if (p.id === 'custom' && !custom.from) {
                    const today = riyadhDate()
                    setCustom({ from: monthStart(today), to: today })
                  }
                }}
                className={`py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                  period === p.id ? 'bg-emerald-600 text-white shadow' : 'muted hover:text-emerald-500'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs muted space-y-1">
                <span>من</span>
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  className="w-full field rounded-lg p-2 text-sm"
                />
              </label>
              <label className="text-xs muted space-y-1">
                <span>إلى</span>
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  className="w-full field rounded-lg p-2 text-sm"
                />
              </label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users size={16} className="muted shrink-0" />
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="field rounded-lg p-2 text-sm flex-1">
              <option value="">كل المستخدمين</option>
              {(stats?.users || []).map((u) => (
                <option key={u.username} value={u.username}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
            {userFilter && (
              <button onClick={() => setUserFilter('')} className="text-sm muted hover:text-emerald-500 shrink-0">
                مسح
              </button>
            )}
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
        </section>

        {stats?.lowAlerts?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start"
          >
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-bold text-amber-600 dark:text-amber-400">أقسام لم تصل اليوم للحد المتوقّع ({stats.minDaily} وجبات يومياً):</p>
              <p className="muted mt-1">{stats.lowAlerts.map((a) => `${a.name} (${a.total})`).join(' — ')}</p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={CalendarDays} label={`إجمالي الطلبات — ${range.label}`} value={sum.total} from="from-emerald-500" to="to-emerald-600" />
          <StatCard icon={User} label="المرضى" value={sum.patient} from="from-sky-500" to="to-sky-600" />
          <StatCard icon={UserPlus} label="المرافقون" value={sum.companion} from="from-violet-500" to="to-violet-600" />
          <StatCard icon={BarChart3} label="المتوسط اليومي" value={sum.avgDaily} from="from-amber-500" to="to-amber-600" />
        </div>

        <section className="space-y-4">
          <h3 className="text-lg font-bold">
            الطلبات حسب القسم — {range.label} <span className="text-xs muted font-normal">(اضغط للتفصيل)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(stats?.byDepartment || []).map((d, i) => {
              const c = colorClasses(d.color || deptById[d.id]?.color)
              const pct = Math.min(100, (d.total / deptTarget) * 100)
              return (
                <motion.button
                  key={d.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => setOpenDept(d)}
                  className={`text-right card rounded-3xl p-5 ring-1 ${c.ring} hover:scale-[1.02] transition-transform`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <ChevronLeft size={16} className="muted" />
                  </div>
                  <p className="text-sm muted mt-3">{d.name}</p>
                  <p className="text-4xl font-bold mt-1">{d.total}</p>
                  <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-3 overflow-hidden">
                    <div className={`h-full ${c.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs muted">
                    <span className="flex items-center gap-1">
                      <User size={13} /> {d.patient}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserPlus size={13} /> {d.companion}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="card rounded-3xl p-6 lg:col-span-2">
            <h3 className="text-lg font-bold mb-5">
              اتجاه الطلبات — {TREND_TITLE[unit]} <span className="text-xs muted font-normal">({range.label})</span>
            </h3>
            <div className="flex items-end justify-between gap-0.5 sm:gap-1.5 h-44" dir="ltr">
              {points.map((t, i) => (
                <div key={t.key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-end justify-center h-32">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(t.count / maxTrend) * 100}%` }}
                      className="w-full max-w-[34px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md"
                      style={{ minHeight: t.count ? 6 : 2 }}
                      title={`${trendLabel(unit, t.key)}: ${t.count} طلب`}
                    />
                  </div>
                  <span className="text-[11px] font-bold h-4">{points.length <= 14 ? t.count : ''}</span>
                  <span className="text-[9px] muted h-3 whitespace-nowrap">{i % labelStep === 0 ? trendLabel(unit, t.key) : ''}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card rounded-3xl p-6 flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold mb-4 self-start">نوع الشخص — {range.label}</h3>
            <Donut patient={person.patient || 0} companion={person.companion || 0} />
            <div className="flex gap-6 mt-4">
              <Legend color="bg-emerald-500" label="المرضى" value={person.patient || 0} />
              <Legend color="bg-sky-500" label="المرافقون" value={person.companion || 0} />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="card rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-4">حسب وقت الوجبة — {range.label}</h3>
            <div className="space-y-3">
              {Object.entries(stats?.byMealTime || {}).map(([k, v]) => (
                <Bar
                  key={k}
                  label={MEAL_TIME_BY_ID[k]?.name || k}
                  value={v}
                  max={Math.max(1, ...Object.values(stats?.byMealTime || { x: 1 }))}
                />
              ))}
            </div>
          </section>
          <section className="card rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-1">حسب المستخدم — {range.label}</h3>
            <p className="text-xs muted mb-4">اضغط على الاسم لعرض مؤشراته فقط</p>
            <div className="space-y-3">
              {byUser.map((u) => (
                <button key={u.username} onClick={() => setUserFilter(u.username)} className="block w-full text-right">
                  <Bar label={`${u.name} (${u.username})`} value={u.total} max={maxUser} />
                </button>
              ))}
              {byUser.length === 0 && <p className="text-sm muted text-center py-6">لا توجد طلبات في هذه الفترة.</p>}
            </div>
          </section>
        </div>

        {canNotes ? (
          <NoteForm />
        ) : (
          <section className="card rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-4">معلومة</h3>
            <p className="text-sm muted">تظهر الطلبات الجديدة وتنبيهات نقص الطلبات وملاحظات المشرف في أيقونة الجرس بالأعلى.</p>
          </section>
        )}
      </main>
      {openDept && (
        <DeptModal dept={openDept} range={range} user={userFilter} scope={scope} onClose={() => setOpenDept(null)} />
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, from, to }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card rounded-3xl p-5 overflow-hidden relative">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${from} ${to} text-white shadow-lg`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-bold mt-4">{value}</p>
      <p className="text-xs muted mt-1">{label}</p>
    </motion.div>
  )
}

function Bar({ label, value, max }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          className="h-full rounded-full bg-gradient-to-l from-sky-600 to-sky-400"
        />
      </div>
    </div>
  )
}

function Legend({ color, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="muted">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

function Donut({ patient, companion }) {
  const total = patient + companion
  const circ = 2 * Math.PI * 52
  const arc = circ * (total ? patient / total : 0)
  return (
    <div className="relative w-40 h-40">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={52} fill="none" strokeWidth="16" className="stroke-sky-500" />
        <circle
          cx="70"
          cy="70"
          r={52}
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          className="stroke-emerald-500"
          strokeDasharray={`${arc} ${circ - arc}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{total}</span>
        <span className="text-xs muted">الإجمالي</span>
      </div>
    </div>
  )
}

function NoteForm() {
  const [message, setMessage] = useState('')
  const [department, setDepartment] = useState('')
  const [state, setState] = useState('idle')
  const { departments } = useDepartments()

  const submit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setState('sending')
    try {
      const r = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, department: department || null }),
      })
      if (r.ok) {
        setMessage('')
        setDepartment('')
        setState('sent')
        setTimeout(() => setState('idle'), 2500)
      } else setState('idle')
    } catch {
      setState('idle')
    }
  }

  return (
    <section className="card rounded-3xl p-6">
      <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
        <Send size={18} className="text-emerald-500" /> إرسال ملاحظة للموظفين
      </h3>
      <p className="text-xs muted mb-4">تصل الموظفين في أيقونة الإشعارات (اختيارية)</p>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="اكتب ملاحظتك أو تنبيهك هنا..."
          className="w-full field rounded-xl p-3 resize-none"
        />
        <div className="flex gap-3">
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="field rounded-xl p-2.5 text-sm flex-1">
            <option value="">كل الأقسام</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            disabled={state === 'sending'}
            className={`px-5 rounded-xl font-bold text-white transition-colors ${
              state === 'sent' ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {state === 'sent' ? 'تم الإرسال' : 'إرسال'}
          </button>
        </div>
      </form>
    </section>
  )
}

function DeptModal({ dept, range, user, scope, onClose }) {
  const [orders, setOrders] = useState(null)
  const qs = rangeQuery(range, user, { department: dept.id })

  useEffect(() => {
    fetch('/api/orders?' + qs)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
  }, [qs])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="p-5 border-b border-token flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">طلبات {dept.name} — {scope}</h3>
            <p className="text-xs muted">{orders ? `${orders.length} طلب` : 'جارٍ التحميل...'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl muted hover:text-rose-500 hover:bg-rose-500/10">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {orders?.map((o) => (
            <div key={o.id} className="card-2 rounded-2xl p-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{o.patientName || 'بدون اسم'}</p>
                <p className="text-xs muted mt-0.5">
                  غرفة {o.room} · سرير {bedLabel(o.bed)} · {personTypeName(o.personType)}
                </p>
                <p className="text-sm mt-1">
                  {o.mainMeal}
                  {o.options?.length ? ` + ${o.options.join('، ')}` : ''}
                </p>
                {o.notes && <p className="text-xs muted mt-1">📝 {o.notes}</p>}
                <p className="text-[11px] muted mt-1">بواسطة {o.createdByName || o.createdBy}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-xs text-emerald-500 flex items-center gap-1 justify-end">
                  <Clock size={12} /> {timeAgo(o.createdAt)}
                </p>
                <p className="text-[10px] muted mt-1">{fmtDate(o.createdAt)}</p>
              </div>
            </div>
          ))}
          {orders && orders.length === 0 && <div className="text-center py-12 muted">لا توجد طلبات لهذا القسم في هذه الفترة.</div>}
        </div>
        {/* The full log filters by a single day only. */}
        {range.from === range.to && !user && (
          <div className="p-4 border-t border-token">
            <Link
              href={`/list?department=${encodeURIComponent(dept.id)}&date=${range.from}`}
              className="block text-center text-sm text-emerald-500 font-medium hover:underline"
            >
              فتح في سجل الطلبات الكامل ←
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}

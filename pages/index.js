import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle, CalendarClock, CalendarDays, CalendarRange, ChevronLeft, Clock, Database, Download, Send, User,
  UserPlus, X,
} from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { can, PERMS } from '@/lib/roles'
import { MEAL_TIME_BY_ID, bedLabel, personTypeName } from '@/lib/constants'
import { colorClasses } from '@/lib/departments'
import { fmtDate, timeAgo } from '@/lib/format'
import { exportOrdersCsv } from '@/lib/export'

export default function Dashboard() {
  const { user, loading } = useAuth({ requirePerm: PERMS.VIEW_REPORTS })
  const [stats, setStats] = useState(null)
  const [openDept, setOpenDept] = useState(null)
  const { byId: deptById } = useDepartments({ all: true, enabled: !!user })

  useEffect(() => {
    if (!user) return
    const load = () =>
      fetch('/api/stats')
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {})
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [user])

  if (loading || !user) return <Spinner />

  const ind = stats?.indicators || { daily: 0, weekly: 0, monthly: 0, total: 0 }
  const maxTrend = Math.max(1, ...(stats?.trend || []).map((t) => t.count))
  const person = stats?.byPersonType || { patient: 0, companion: 0 }
  const canExport = can(user.role, PERMS.EXPORT_REPORTS)
  const canNotes = can(user.role, PERMS.SEND_NOTES)
  const today = stats?.today

  const exportToday = async () => {
    const r = await fetch(`/api/orders?date=${today}`)
    const d = await r.json()
    exportOrdersCsv(d.orders || [], deptById, 'تقرير-اليوم')
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>لوحة المؤشرات | قسم التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">لوحة المؤشرات</h2>
            <p className="text-sm muted mt-1">ملخص طلبات الوجبات — أرقام الأقسام والتوزيع خاصة باليوم</p>
          </div>
          {canExport && (
            <button
              onClick={exportToday}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Download size={18} /> تصدير تقرير اليوم
            </button>
          )}
        </div>

        {stats?.lowAlerts?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start"
          >
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-bold text-amber-600 dark:text-amber-400">أقسام لم تصل للحد المتوقّع ({stats.minDaily} وجبات يومياً):</p>
              <p className="muted mt-1">{stats.lowAlerts.map((a) => `${a.name} (${a.total})`).join(' — ')}</p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={CalendarDays} label="طلبات اليوم" value={ind.daily} from="from-emerald-500" to="to-emerald-600" />
          <StatCard icon={CalendarRange} label="هذا الأسبوع" value={ind.weekly} from="from-sky-500" to="to-sky-600" />
          <StatCard icon={CalendarClock} label="هذا الشهر" value={ind.monthly} from="from-violet-500" to="to-violet-600" />
          <StatCard icon={Database} label="إجمالي الطلبات" value={ind.total} from="from-amber-500" to="to-amber-600" />
        </div>

        <section className="space-y-4">
          <h3 className="text-lg font-bold">
            الطلبات حسب القسم — اليوم <span className="text-xs muted font-normal">(اضغط للتفصيل)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(stats?.byDepartment || []).map((d, i) => {
              const c = colorClasses(d.color || deptById[d.id]?.color)
              const pct = Math.min(100, (d.total / (stats?.minDaily || 5)) * 100)
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
            <h3 className="text-lg font-bold mb-5">اتجاه الطلبات — آخر ٧ أيام</h3>
            <div className="flex items-end justify-between gap-2 h-44">
              {(stats?.trend || []).map((t) => (
                <div key={t.date} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center h-32">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(t.count / maxTrend) * 100}%` }}
                      className="w-full max-w-[34px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg"
                      style={{ minHeight: t.count ? 6 : 2 }}
                      title={`${t.count} طلب`}
                    />
                  </div>
                  <span className="text-sm font-bold">{t.count}</span>
                  <span className="text-[9px] muted">{t.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card rounded-3xl p-6 flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold mb-4 self-start">نوع الشخص — اليوم</h3>
            <Donut patient={person.patient || 0} companion={person.companion || 0} />
            <div className="flex gap-6 mt-4">
              <Legend color="bg-emerald-500" label="المرضى" value={person.patient || 0} />
              <Legend color="bg-sky-500" label="المرافقون" value={person.companion || 0} />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="card rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-4">حسب وقت الوجبة — اليوم</h3>
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
          {canNotes ? (
            <NoteForm />
          ) : (
            <section className="card rounded-3xl p-6">
              <h3 className="text-lg font-bold mb-4">معلومة</h3>
              <p className="text-sm muted">تظهر تنبيهات نقص الطلبات وملاحظات المشرف في أيقونة الجرس بالأعلى.</p>
            </section>
          )}
        </div>
      </main>
      {openDept && <DeptModal dept={openDept} date={today} onClose={() => setOpenDept(null)} />}
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
        <span className="text-xs muted">إجمالي اليوم</span>
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

function DeptModal({ dept, date, onClose }) {
  const [orders, setOrders] = useState(null)

  useEffect(() => {
    fetch(`/api/orders?department=${encodeURIComponent(dept.id)}&date=${date}`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
  }, [dept.id, date])

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
            <h3 className="font-bold text-lg">طلبات {dept.name} — اليوم</h3>
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
              </div>
              <div className="text-left shrink-0">
                <p className="text-xs text-emerald-500 flex items-center gap-1 justify-end">
                  <Clock size={12} /> {timeAgo(o.createdAt)}
                </p>
                <p className="text-[10px] muted mt-1">{fmtDate(o.createdAt)}</p>
              </div>
            </div>
          ))}
          {orders && orders.length === 0 && <div className="text-center py-12 muted">لا توجد طلبات لهذا القسم اليوم.</div>}
        </div>
        <div className="p-4 border-t border-token">
          <Link
            href={`/list?department=${encodeURIComponent(dept.id)}&date=${date}`}
            className="block text-center text-sm text-emerald-500 font-medium hover:underline"
          >
            فتح في سجل الطلبات الكامل ←
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle, Award, BarChart3, CalendarDays, CheckCheck, ChevronLeft, Clock, Download, FileText, Filter, Send, Trash2, TrendingDown,
  TrendingUp, User, UserPlus, Users, Utensils, X,
} from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { ROLE_LIST, can, PERMS, roleName } from '@/lib/roles'
import { MEAL_TIME_BY_ID, bedLabel, personTypeName } from '@/lib/constants'
import { colorClasses } from '@/lib/departments'
import { fmtDate, nameLabels, timeAgo } from '@/lib/format'
import { exportReportXlsx, openReport } from '@/lib/export'
import { useLive } from '@/lib/useLive'
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
  const { user, loading } = useAuth({ requirePerm: PERMS.VIEW_DASHBOARD })
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [openDept, setOpenDept] = useState(null)
  const [period, setPeriod] = useState('today')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [userFilter, setUserFilter] = useState('')
  const { departments: deptList, byId: deptById } = useDepartments({ all: true, enabled: !!user })
  const [reporting, setReporting] = useState('')
  const [liveTick, setLiveTick] = useState(0)

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
    // Live updates come through useLive below; this is only a slow safety net.
    const t = setInterval(load, 60000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [user, qs, liveTick])
  // Note 10: a new order, note or menu edit anywhere refreshes the dashboard within seconds.
  useLive(() => setLiveTick((n) => n + 1), !!user)

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
  const userOptions = nameLabels(stats?.users)
  const userName = userOptions.find((u) => u.username === userFilter)?.label || ''
  const scope = `${range.label}${userFilter ? ` · ${userName}` : ''}`
  // Expected volume for the period, so the department bars stay comparable across periods.
  const deptTarget = (stats?.minDaily || 5) * (stats?.days || 1)

  // Notes 3 and 5: the period report (PDF in the same page, or Excel) for exactly what the dashboard shows.
  const reportInput = async () => {
    const [o, m] = await Promise.all([
      fetch('/api/orders?' + qs).then((r) => r.json()),
      fetch('/api/menu').then((r) => r.json()).catch(() => ({})),
    ])
    return {
      kind: 'period',
      title: 'تقرير لوحة المؤشرات',
      periodLabel: range.from === range.to ? range.from : `${range.from} إلى ${range.to}`,
      filtersLabel: userFilter ? `المستخدم: ${userName}` : '',
      orders: o.orders || [],
      from: range.from,
      to: range.to,
      departments: deptList,
      deptById,
      users: stats?.users || [],
      menu: m.menu || null,
      generatedBy: user.name,
    }
  }
  const runReport = async (kind) => {
    setReporting(kind)
    try {
      const r = await reportInput()
      if (kind === 'pdf') await openReport(r)
      else await exportReportXlsx(r)
    } catch (e) {
      console.error(e)
      setError('تعذّر إنشاء التقرير')
    } finally {
      setReporting('')
    }
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>لوحة المؤشرات | قسم خدمات التغذية - نيوتريا</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">لوحة المؤشرات</h2>
            <p className="text-sm muted mt-1">ملخص طلبات الوجبات — {scope}</p>
          </div>
          {canExport && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => runReport('pdf')}
                disabled={!sum.total || !!reporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
              >
                <FileText size={18} /> {reporting === 'pdf' ? 'جارٍ التجهيز...' : 'تقرير الفترة PDF'}
              </button>
              <button
                onClick={() => runReport('xlsx')}
                disabled={!sum.total || !!reporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold card-2 hover:border-emerald-500/40 transition-colors disabled:opacity-50"
              >
                <Download size={18} /> {reporting === 'xlsx' ? 'جارٍ التجهيز...' : 'Excel'}
              </button>
            </div>
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
              {userOptions.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.label}
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
              <Legend color="bg-sky-500" label="المرضى" value={person.patient || 0} />
              <Legend color="bg-indigo-500" label="المرافقون" value={person.companion || 0} />
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
                  <Bar label={u.name} value={u.total} max={maxUser} />
                </button>
              ))}
              {byUser.length === 0 && <p className="text-sm muted text-center py-6">لا توجد طلبات في هذه الفترة.</p>}
            </div>
          </section>
        </div>

        <MealsSection stats={stats} label={range.label} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Note 12: fixed chart over all time, independent of the filters above. */}
          <section className="card rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Utensils size={18} className="text-emerald-500" /> مقارنة الوجبات بعدد الصرف
            </h3>
            <p className="text-xs muted mb-4">لكل الفترة منذ بداية النظام (لا تتأثر بالتصفية)</p>
            <div className="space-y-3">
              {(stats?.mealsAllTime || []).slice(0, 15).map((m) => (
                <Bar key={m.name} label={m.name} value={m.total} max={Math.max(1, stats.mealsAllTime[0]?.total || 1)} />
              ))}
              {!stats?.mealsAllTime?.length && <p className="text-sm muted text-center py-6">لا توجد طلبات بعد.</p>}
            </div>
          </section>
          {/* Note 13: orders entered by each specialist and distributor, all time. */}
          <section className="card rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Users size={18} className="text-emerald-500" /> الأخصائيات والموزعات بعدد إدخال الطلبات
            </h3>
            <p className="text-xs muted mb-4">لكل الفترة منذ بداية النظام (لا تتأثر بالتصفية)</p>
            <div className="space-y-3">
              {(stats?.staffAllTime || []).map((u) => (
                <Bar
                  key={u.username}
                  label={`${u.name} · ${roleName(u.role)}`}
                  value={u.total}
                  max={Math.max(1, ...(stats.staffAllTime || []).map((x) => x.total))}
                />
              ))}
              {!stats?.staffAllTime?.length && <p className="text-sm muted text-center py-6">لا توجد حسابات أخصائيات أو موزعات.</p>}
            </div>
          </section>
        </div>

        {canNotes ? (
          <NotesPanel />
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
        <circle cx="70" cy="70" r={52} fill="none" strokeWidth="16" className="stroke-indigo-500" />
        <circle
          cx="70"
          cy="70"
          r={52}
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          className="stroke-sky-500"
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

/** Note 5: meals ranked by orders in the period, with shares, top 3 / bottom 3 and patient vs companion. */
function MealsSection({ stats, label }) {
  const meals = stats?.meals || []
  const max = Math.max(1, ...meals.map((m) => m.total))
  return (
    <section className="card rounded-3xl p-6 space-y-5">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Award size={18} className="text-emerald-500" /> الوجبات الأكثر والأقل طلبًا — {label}
      </h3>
      {meals.length === 0 ? (
        <p className="text-sm muted text-center py-6">لا توجد طلبات في هذه الفترة.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RankBox title="الأعلى طلبًا" icon={TrendingUp} tone="text-green-600 bg-green-600/10" items={stats.mealsTop} />
            <RankBox title="الأقل طلبًا" icon={TrendingDown} tone="text-rose-500 bg-rose-500/10" items={stats.mealsBottom} />
          </div>
          <div className="space-y-3">
            <div className="flex gap-4 text-xs muted">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-500" /> مريض</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500" /> مرافق</span>
            </div>
            {meals.slice(0, 20).map((m, i) => (
              <div key={m.name}>
                <div className="flex justify-between gap-2 text-sm mb-1">
                  <span className="truncate">
                    <b className="muted ml-1">{i + 1}.</b> {m.name}
                  </span>
                  <span className="font-bold whitespace-nowrap" dir="ltr">
                    {m.total} <span className="muted font-normal">({m.pct}%)</span>
                  </span>
                </div>
                <div className="h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex" title={`مريض ${m.patient} · مرافق ${m.companion}`}>
                  <div className="h-full bg-sky-500" style={{ width: `${(m.patient / max) * 100}%` }} />
                  <div className="h-full bg-indigo-500" style={{ width: `${(m.companion / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function RankBox({ title, icon: Icon, tone, items = [] }) {
  return (
    <div className="card-2 rounded-2xl p-4">
      <p className="font-bold text-sm mb-3 flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon size={15} />
        </span>
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs muted">—</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((m, i) => (
            <li key={m.name} className="flex justify-between gap-2 text-sm">
              <span className="truncate">
                {i + 1}. {m.name}
              </span>
              <span className="font-bold whitespace-nowrap" dir="ltr">
                {m.total} <span className="muted font-normal text-xs">({m.pct}%)</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const AUDIENCES = [
  { id: 'all', name: 'الكل' },
  { id: 'role', name: 'حسب الدور' },
  { id: 'users', name: 'أشخاص محددون' },
]

/**
 * Note 11: send a note to everyone, to roles, or to chosen people, and follow who read it.
 * A note is visible only to its sender and its recipients; only the sender can delete it (for everyone).
 */
function NotesPanel() {
  const [message, setMessage] = useState('')
  const [department, setDepartment] = useState('')
  const [audience, setAudience] = useState('all')
  const [roles, setRoles] = useState([])
  const [userIds, setUserIds] = useState([])
  const [people, setPeople] = useState([])
  const [sent, setSent] = useState([])
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const { departments } = useDepartments()

  const loadSent = () =>
    fetch('/api/notes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSent((d.notes || []).filter((n) => n.mine)))
      .catch(() => {})
  useEffect(() => {
    loadSent()
    fetch('/api/notes?recipients=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPeople(d.users || []))
      .catch(() => {})
  }, [])
  // Read receipts update live (note 10).
  useLive(loadSent)

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!message.trim()) return
    setState('sending')
    try {
      const r = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, department: department || null, audience, roles, userIds }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setMessage('')
        setDepartment('')
        setState('sent')
        loadSent()
        setTimeout(() => setState('idle'), 2500)
      } else {
        setError(d.error || 'تعذّر الإرسال')
        setState('idle')
      }
    } catch {
      setError('خطأ في الاتصال بالشبكة')
      setState('idle')
    }
  }

  const remove = async (id) => {
    if (!confirm('حذف الملاحظة لدى جميع المستلمين؟')) return
    const r = await fetch('/api/notes?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => null)
    if (r?.ok) setSent((list) => list.filter((n) => n.id !== id))
  }

  const audienceLabel = (n) =>
    n.audience === 'role' ? n.targetRoles.map(roleName).join('، ') : n.audience === 'users' ? 'أشخاص محددون' : 'الكل'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="card rounded-3xl p-6">
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Send size={18} className="text-emerald-500" /> إرسال ملاحظة
        </h3>
        <p className="text-xs muted mb-4">تصل المستلمين فقط في أيقونة الإشعارات، وتعرف من قرأها</p>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="اكتب ملاحظتك أو تنبيهك هنا..."
            className="w-full field rounded-xl p-3 resize-none"
          />
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl card-2">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAudience(a.id)}
                className={`py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                  audience === a.id ? 'bg-emerald-600 text-white shadow' : 'muted hover:text-emerald-500'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
          {audience === 'role' && (
            <div className="flex flex-wrap gap-2">
              {ROLE_LIST.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(roles, setRoles, r.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border ${
                    roles.includes(r.id) ? 'bg-emerald-600 border-emerald-600 text-white' : 'card-2'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
          {audience === 'users' && (
            <div className="max-h-48 overflow-y-auto card-2 rounded-xl p-2 space-y-1">
              {people.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm p-1.5 rounded-lg hover:bg-emerald-500/5 cursor-pointer">
                  <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => toggle(userIds, setUserIds, u.id)} />
                  <span>{u.name}</span>
                  <span className="text-xs muted">· {roleName(u.role)}</span>
                </label>
              ))}
              {people.length === 0 && <p className="text-xs muted p-2">لا يوجد مستخدمون</p>}
            </div>
          )}
          <div className="flex gap-3">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="field rounded-xl p-2.5 text-sm flex-1">
              <option value="">بدون قسم محدد</option>
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
          {error && <p className="text-sm text-rose-500">{error}</p>}
        </form>
      </section>
      <section className="card rounded-3xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <CheckCheck size={18} className="text-emerald-500" /> ملاحظاتي المرسلة وحالة القراءة
        </h3>
        <div className="space-y-3 max-h-[28rem] overflow-y-auto">
          {sent.map((n) => (
            <div key={n.id} className="card-2 rounded-2xl p-3">
              <div className="flex justify-between gap-2">
                <p className="text-sm font-medium break-words">{n.message}</p>
                <button onClick={() => remove(n.id)} title="حذف للجميع" className="muted hover:text-rose-500 shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-[11px] muted mt-1">
                إلى: {audienceLabel(n)} · {timeAgo(n.createdAt)}
              </p>
              {n.receipts && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-bold text-emerald-500">
                    قرأها {n.receipts.read} من {n.receipts.total}
                  </summary>
                  <div className="mt-1 space-y-0.5">
                    {n.receipts.readers.map((r) => (
                      <p key={r.name + r.readAt}>✓ {r.name} <span className="muted">· {timeAgo(r.readAt)}</span></p>
                    ))}
                    {n.receipts.pending.map((name) => (
                      <p key={name} className="muted">○ {name} (لم تُقرأ)</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
          {sent.length === 0 && <p className="text-sm muted text-center py-6">لم ترسل أي ملاحظة بعد.</p>}
        </div>
      </section>
    </div>
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
        {range.from === range.to && (
          <div className="p-4 border-t border-token">
            <Link
              href={`/list?department=${encodeURIComponent(dept.id)}&date=${range.from}${user ? `&user=${encodeURIComponent(user)}` : ''}`}
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

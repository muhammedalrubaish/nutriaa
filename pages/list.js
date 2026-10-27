import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Download, Filter, ListChecks, Printer, Trash2 } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/lib/useAuth'
import { useDepartments } from '@/lib/useDepartments'
import { can, PERMS } from '@/lib/roles'
import { DAY_BY_ID, MEAL_TIME_BY_ID, bedLabel, personTypeName } from '@/lib/constants'
import { fmtDate, timeAgo } from '@/lib/format'
import { exportOrdersCsv, printOrderCards } from '@/lib/export'

export default function List() {
  const { user, loading } = useAuth({ requirePerm: PERMS.VIEW_REPORTS })
  const router = useRouter()
  const { departments, byId } = useDepartments({ all: true, enabled: !!user })
  const [orders, setOrders] = useState([])
  const [department, setDepartment] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (router.query.department) setDepartment(String(router.query.department))
    if (router.query.date) setDate(String(router.query.date))
  }, [router.isReady])

  const load = useCallback(() => {
    const p = new URLSearchParams()
    if (department) p.set('department', department)
    if (date) p.set('date', date)
    fetch('/api/orders?' + p.toString())
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {})
  }, [department, date])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  if (loading || !user) return <Spinner />

  const canDelete = can(user.role, PERMS.DELETE_ORDERS)
  const canExport = can(user.role, PERMS.EXPORT_REPORTS)

  const remove = async (id) => {
    if (!confirm('حذف هذا الطلب؟')) return
    setBusy(true)
    await fetch('/api/orders?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
    setBusy(false)
    load()
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>سجل الطلبات | قسم التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-600/15 text-emerald-500 rounded-xl flex items-center justify-center">
              <ListChecks size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">سجل الطلبات</h2>
              <p className="text-sm muted">جميع طلبات الوجبات مع تاريخ ووقت التسجيل والوقت المنقضي</p>
            </div>
          </div>
          {canExport && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => printOrderCards(orders, byId)}
                disabled={orders.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
              >
                <Printer size={18} /> طباعة بطاقات ({orders.length})
              </button>
              <button
                onClick={() => exportOrdersCsv(orders, byId)}
                disabled={orders.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
              >
                <Download size={18} /> تصدير Excel ({orders.length})
              </button>
            </div>
          )}
        </div>

        <div className="card rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm muted">
            <Filter size={16} /> تصفية:
          </span>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="field rounded-lg p-2 text-sm">
            <option value="">كل الأقسام</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.active ? '' : ' (غير مفعّل)'}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field rounded-lg p-2 text-sm" />
          {(department || date) && (
            <button
              onClick={() => {
                setDepartment('')
                setDate('')
              }}
              className="text-sm muted hover:text-emerald-500"
            >
              مسح
            </button>
          )}
          <span className="text-sm muted mr-auto">{orders.length} طلب</span>
        </div>

        <div className="card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="card-2 muted text-right">
                <tr>
                  <Th>القسم</Th>
                  <Th>الغرفة</Th>
                  <Th>السرير</Th>
                  <Th>اسم المريض</Th>
                  <Th>النوع</Th>
                  <Th>اليوم</Th>
                  <Th>الوجبة</Th>
                  <Th>الأساسية</Th>
                  <Th>إضافات</Th>
                  <Th>الموظف</Th>
                  <Th>التاريخ والوقت</Th>
                  <Th>منذ</Th>
                  {canDelete && <Th />}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-token hover:bg-emerald-500/[0.04]">
                    <Td>{byId[o.department]?.name || o.department}</Td>
                    <Td>{o.room}</Td>
                    <Td>{bedLabel(o.bed)}</Td>
                    <Td className="font-medium">{o.patientName || '—'}</Td>
                    <Td>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          o.personType === 'patient' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-sky-500/15 text-sky-500'
                        }`}
                      >
                        {personTypeName(o.personType)}
                      </span>
                    </Td>
                    <Td className="muted">{o.day ? DAY_BY_ID[o.day]?.name || o.day : '—'}</Td>
                    <Td>{MEAL_TIME_BY_ID[o.mealTime]?.name || o.mealTime}</Td>
                    <Td>{o.mainMeal}</Td>
                    <Td className="muted text-xs max-w-[160px]">{o.options?.length ? o.options.join('، ') : '—'}</Td>
                    <Td className="muted">{o.createdByName || o.createdBy}</Td>
                    <Td className="muted text-xs whitespace-nowrap">{fmtDate(o.createdAt)}</Td>
                    <Td className="text-xs whitespace-nowrap text-emerald-500">{timeAgo(o.createdAt)}</Td>
                    {canDelete && (
                      <Td>
                        <button disabled={busy} onClick={() => remove(o.id)} className="muted hover:text-rose-500 p-1" title="حذف">
                          <Trash2 size={16} />
                        </button>
                      </Td>
                    )}
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={13} className="text-center py-12 muted">
                      لا توجد طلبات مطابقة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

const Th = ({ children }) => <th className="px-4 py-3 font-medium whitespace-nowrap">{children}</th>
const Td = ({ children, className = '' }) => <td className={`px-4 py-3 ${className}`}>{children}</td>

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, BellOff, BellRing, AlertTriangle, CheckCheck, ClipboardCheck, MessageSquare, Trash2, X,
} from 'lucide-react'
import { can, PERMS } from '@/lib/roles'
import { MEAL_TIME_BY_ID, bedLabel, personTypeName } from '@/lib/constants'
import { timeAgo } from '@/lib/format'
import { riyadhDate } from '@/lib/time'
import { useDepartments } from '@/lib/useDepartments'

const EMPTY = { alerts: [], notes: [], orders: [] }
const OPEN_EVENT = 'notifs:open'

// Dismissals: { date, alerts:[deptIds], notes:[noteIds], orders:[orderIds] }.
// Alert and order dismissals reset daily (Riyadh date); both lists only ever hold today's items.
function readDismissed() {
  const fresh = { date: riyadhDate(), alerts: [], notes: [], orders: [] }
  try {
    const raw = localStorage.getItem('dismissed_notifs')
    if (!raw) return fresh
    const d = JSON.parse(raw)
    if (d.date !== riyadhDate()) return { ...fresh, notes: d.notes || [] }
    return { ...fresh, ...d }
  } catch {
    return fresh
  }
}

function writeDismissed(d) {
  try {
    localStorage.setItem('dismissed_notifs', JSON.stringify(d))
  } catch {}
}

function visible(data, dismissed) {
  const d = data || EMPTY
  return {
    alerts: (d.alerts || []).filter((a) => !dismissed.alerts.includes(a.department)),
    notes: (d.notes || []).filter((n) => !dismissed.notes.includes(n.id)),
    orders: (d.orders || []).filter((o) => !dismissed.orders.includes(o.id)),
  }
}

const orderLine = (o) =>
  `غرفة ${o.room} · سرير ${bedLabel(o.bed)} · ${personTypeName(o.personType)} · ${MEAL_TIME_BY_ID[o.mealTime]?.name || o.mealTime}`

export function NotificationsBell({ user, data, setData }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(EMPTY)
  const ref = useRef(null)
  const { byId } = useDepartments({ all: true })

  useEffect(() => setDismissed(readDismissed()), [])
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onOpen = () => {
      setDismissed(readDismissed())
      setOpen(true)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  const canDelete = can(user?.role, PERMS.SEND_NOTES)
  const { alerts, notes, orders } = visible(data, dismissed)
  const count = alerts.length + notes.length + orders.length

  const save = (d) => {
    setDismissed(d)
    writeDismissed(d)
  }
  const dismiss = (kind, id) => save({ ...dismissed, date: riyadhDate(), [kind]: [...dismissed[kind], id] })
  const deleteNote = async (id) => {
    await fetch('/api/notes?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
    dismiss('notes', id)
    setData?.((d) => ({ ...(d || EMPTY), notes: (d?.notes || []).filter((n) => n.id !== id) }))
  }
  const readAll = () =>
    save({
      date: riyadhDate(),
      alerts: (data?.alerts || []).map((a) => a.department),
      notes: [...dismissed.notes, ...(data?.notes || []).map((n) => n.id)],
      orders: [...dismissed.orders, ...(data?.orders || []).map((o) => o.id)],
    })

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl muted hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
        title="الإشعارات"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        // Phones: pinned under the header across the full width (an absolutely positioned panel ran off-screen).
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:left-0 sm:mt-2 sm:w-96 card rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
          <div className="p-3 border-b border-token flex items-center justify-between">
            <span className="font-bold text-sm flex items-center gap-2">
              الإشعارات
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">{count}</span>
            </span>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  onClick={readAll}
                  className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors"
                >
                  <CheckCheck size={14} /> قراءة الكل
                </button>
              )}
              <button onClick={() => setOpen(false)} className="muted hover:text-rose-500 p-1 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {orders.length > 0 && (
              <Group title="طلبات جديدة اليوم" count={orders.length}>
                {orders.map((o) => (
                  <Item
                    key={o.id}
                    icon={ClipboardCheck}
                    tone="text-sky-500 bg-sky-500/10"
                    title={`طلب جديد — ${o.departmentName || byId[o.department]?.name || o.department}`}
                    onDismiss={() => dismiss('orders', o.id)}
                  >
                    <p className="text-xs muted mt-0.5">{orderLine(o)}</p>
                    <p className="text-xs mt-0.5 truncate">{o.mainMeal}</p>
                    <p className="text-[11px] muted mt-1">
                      {o.createdByName} · {timeAgo(o.createdAt)}
                    </p>
                  </Item>
                ))}
              </Group>
            )}
            {notes.length > 0 && (
              <Group title="ملاحظات المشرف" count={notes.length}>
                {notes.map((n) => (
                  <Item
                    key={n.id}
                    icon={MessageSquare}
                    tone="text-emerald-500 bg-emerald-500/10"
                    title={n.message}
                    onDismiss={() => dismiss('notes', n.id)}
                    onDelete={canDelete ? () => deleteNote(n.id) : null}
                  >
                    <p className="text-[11px] muted mt-1">
                      {n.department ? (byId[n.department]?.name || n.department) + ' · ' : ''}
                      {n.createdByName} · {timeAgo(n.createdAt)}
                    </p>
                  </Item>
                ))}
              </Group>
            )}
            {alerts.length > 0 && (
              <Group title="تنبيهات نقص الطلبات" count={alerts.length}>
                {alerts.map((a) => (
                  <Item
                    key={a.department}
                    icon={AlertTriangle}
                    tone="text-amber-500 bg-amber-500/10"
                    title={`${a.name}: ${a.total} طلب اليوم`}
                    onDismiss={() => dismiss('alerts', a.department)}
                  >
                    <p className="text-xs muted mt-0.5">أقل من الحد المتوقّع ({a.min} وجبات يومياً)</p>
                  </Item>
                ))}
              </Group>
            )}
            {count === 0 && <div className="p-8 text-center text-sm muted">لا توجد إشعارات حالياً.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function Group({ title, count, children }) {
  return (
    <div>
      <p className="px-3 py-1.5 text-[11px] font-bold muted card-2 border-x-0 sticky top-0 z-10">
        {title} ({count})
      </p>
      <div className="divide-y divide-[rgb(var(--border))]">{children}</div>
    </div>
  )
}

function Item({ icon: Icon, tone, title, onDismiss, onDelete, children }) {
  return (
    <div className="p-3 flex gap-3 items-start">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={16} />
      </span>
      <div className="text-sm flex-1 min-w-0">
        <p className="font-medium leading-snug break-words">{title}</p>
        {children}
      </div>
      <div className="flex gap-0.5 shrink-0">
        <button onClick={onDismiss} title="إخفاء" className="muted hover:text-emerald-500 p-1 transition-colors">
          <X size={14} />
        </button>
        {onDelete && (
          <button onClick={onDelete} title="حذف للجميع" className="muted hover:text-rose-500 p-1 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function PushToggle() {
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    // Hide the toggle when the server has no VAPID keys configured.
    fetch('/api/push/vapid-key')
      .then((r) => {
        if (!r.ok) throw new Error('push disabled')
        return navigator.serviceWorker.ready
      })
      .then((reg) => reg.pushManager.getSubscription().then((s) => setState(s ? 'subscribed' : 'unsubscribed')))
      .catch(() => setState('unsupported'))
  }, [])

  const subscribe = async () => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setState('denied')
        return
      }
      const r = await fetch('/api/push/vapid-key')
      if (!r.ok) return
      const { publicKey } = await r.json()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      setState('subscribed')
    } catch (e) {
      console.error('push subscribe error', e)
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (e) {
      console.error('push unsubscribe error', e)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'unsupported') return null
  if (state === 'denied')
    return (
      <button title="الإشعارات محظورة في المتصفح" className="p-2 rounded-xl muted opacity-40 cursor-not-allowed" disabled>
        <BellOff size={18} />
      </button>
    )
  if (state === 'subscribed')
    return (
      <button
        onClick={unsubscribe}
        disabled={busy}
        title="إيقاف الإشعارات"
        className="p-2 rounded-xl text-emerald-500 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
      >
        <BellRing size={18} />
      </button>
    )
  return (
    <button
      onClick={subscribe}
      disabled={busy}
      title="تفعيل إشعارات الجوال"
      className="p-2 rounded-xl muted hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
    >
      <Bell size={18} />
    </button>
  )
}

// Notification keys already announced by the toast. Module-level (plus sessionStorage) so moving
// between pages, which remounts Nav, does not announce the same notifications again.
let seen = null

function loadSeen() {
  if (seen) return seen
  try {
    const raw = sessionStorage.getItem('seen_notifs')
    seen = raw ? new Set(JSON.parse(raw)) : null
  } catch {
    seen = null
  }
  return seen
}

function saveSeen(keys) {
  seen = new Set(keys)
  try {
    sessionStorage.setItem('seen_notifs', JSON.stringify([...seen]))
  } catch {}
}

function toastFor(item) {
  if (item.kind === 'order') {
    const o = item.value
    return { icon: ClipboardCheck, tone: 'bg-sky-500', title: `طلب جديد — ${o.departmentName || o.department}`, body: orderLine(o) }
  }
  if (item.kind === 'note') {
    const n = item.value
    return { icon: MessageSquare, tone: 'bg-emerald-500', title: `ملاحظة من ${n.createdByName}`, body: n.message }
  }
  const a = item.value
  return { icon: AlertTriangle, tone: 'bg-amber-500', title: 'تنبيه نقص الطلبات', body: `${a.name}: ${a.total} من ${a.min}` }
}

/** Toast shown under the header when new notifications arrive. Tapping it opens the bell panel. */
export function DynamicIsland({ data }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!data) return
    const { alerts, notes, orders } = visible(data, readDismissed())
    // Newest first: orders and notes come sorted by the API.
    const items = [
      ...orders.map((o) => ({ key: 'o:' + o.id, kind: 'order', value: o })),
      ...notes.map((n) => ({ key: 'n:' + n.id, kind: 'note', value: n })),
      ...alerts.map((a) => ({ key: 'a:' + a.department, kind: 'alert', value: a })),
    ]
    const before = loadSeen()
    saveSeen(items.map((i) => i.key))
    let next = null
    if (!before) {
      // First load of this browser session: one summary instead of the newest item.
      if (items.length)
        next = { icon: Bell, tone: 'bg-emerald-500', title: `لديك ${items.length} ${items.length === 1 ? 'إشعار' : 'إشعارات'}`, body: 'اضغط للعرض', extra: 0 }
    } else {
      const fresh = items.filter((i) => !before.has(i.key))
      if (fresh.length) next = { ...toastFor(fresh[0]), extra: fresh.length - 1 }
    }
    if (!next) return
    setToast(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 6000)
  }, [data])

  useEffect(() => () => clearTimeout(timer.current), [])

  const Icon = toast?.icon
  return (
    // The centring lives on a plain wrapper: framer-motion owns `transform` on the animated element,
    // which used to wipe out `-translate-x-1/2` and push the pill half off-screen.
    <div className="fixed inset-x-0 top-[4.25rem] z-[60] flex justify-center px-3 pointer-events-none" dir="rtl">
      <AnimatePresence>
        {toast && (
          <motion.button
            key={toast.title + toast.body}
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={() => {
              clearTimeout(timer.current)
              setToast(null)
              window.dispatchEvent(new Event(OPEN_EVENT))
            }}
            className="pointer-events-auto w-full max-w-sm text-right bg-slate-950/95 text-white backdrop-blur-xl rounded-2xl p-3 flex items-center gap-3 shadow-2xl shadow-black/40 border border-white/10"
          >
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${toast.tone}`}>
              <Icon size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold truncate">{toast.title}</span>
              <span className="block text-xs text-white/70 truncate mt-0.5">{toast.body}</span>
            </span>
            {toast.extra > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/15 shrink-0">+{toast.extra}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

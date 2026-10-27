import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellOff, BellRing, AlertTriangle, CheckCheck, MessageSquare, Trash2, X } from 'lucide-react'
import { can, PERMS } from '@/lib/roles'
import { timeAgo } from '@/lib/format'
import { riyadhDate } from '@/lib/time'
import { useDepartments } from '@/lib/useDepartments'

// Dismissals: { date, alerts:[deptIds], notes:[noteIds] }. Alert dismissals reset daily (Riyadh date).
function readDismissed() {
  try {
    const raw = localStorage.getItem('dismissed_notifs')
    if (!raw) return { date: '', alerts: [], notes: [] }
    const d = JSON.parse(raw)
    if (d.date !== riyadhDate()) return { date: riyadhDate(), alerts: [], notes: d.notes || [] }
    return d
  } catch {
    return { date: riyadhDate(), alerts: [], notes: [] }
  }
}

function writeDismissed(d) {
  try {
    localStorage.setItem('dismissed_notifs', JSON.stringify(d))
  } catch {}
}

export function NotificationsBell({ user, data = { alerts: [], notes: [] }, setData }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState({ date: '', alerts: [], notes: [] })
  const ref = useRef(null)
  const { byId } = useDepartments({ all: true })

  useEffect(() => setDismissed(readDismissed()), [])
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const canDelete = can(user?.role, PERMS.SEND_NOTES)
  const alerts = (data.alerts || []).filter((a) => !dismissed.alerts.includes(a.department))
  const notes = (data.notes || []).filter((n) => !dismissed.notes.includes(n.id))
  const count = alerts.length + notes.length

  const save = (d) => {
    setDismissed(d)
    writeDismissed(d)
  }
  const dismissAlert = (id) => save({ ...dismissed, date: riyadhDate(), alerts: [...dismissed.alerts, id] })
  const dismissNote = (id) => save({ ...dismissed, notes: [...dismissed.notes, id] })
  const deleteNote = async (id) => {
    await fetch('/api/notes?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
    dismissNote(id)
    setData?.((d) => ({ ...d, notes: (d.notes || []).filter((n) => n.id !== id) }))
  }
  const readAll = () =>
    save({
      date: riyadhDate(),
      alerts: (data.alerts || []).map((a) => a.department),
      notes: [...dismissed.notes, ...(data.notes || []).map((n) => n.id)],
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
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-80 max-w-[90vw] card rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-token flex items-center justify-between">
            <span className="font-bold text-sm">الإشعارات</span>
            <div className="flex items-center gap-2">
              <span className="text-xs muted">{count}</span>
              {count > 0 && (
                <button
                  onClick={readAll}
                  className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <CheckCheck size={14} /> قراءة الكل
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {alerts.map((a) => (
              <div key={a.department} className="p-3 flex gap-3 items-start">
                <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm flex-1">
                  <p className="font-medium">
                    {a.name}: عدد الطلبات اليوم {a.total}
                  </p>
                  <p className="text-xs muted mt-0.5">أقل من الحد المتوقّع ({a.min} وجبات يومياً)</p>
                </div>
                <button onClick={() => dismissAlert(a.department)} className="muted hover:text-emerald-500 p-1 shrink-0 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}
            {notes.map((n) => (
              <div key={n.id} className="p-3 flex gap-3 items-start">
                <MessageSquare size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-sm flex-1">
                  <p>{n.message}</p>
                  <p className="text-xs muted mt-1">
                    {n.department ? (byId[n.department]?.name || n.department) + ' · ' : ''}
                    {n.createdByName} · {timeAgo(n.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => dismissNote(n.id)} className="muted hover:text-emerald-500 p-1 transition-colors">
                    <X size={14} />
                  </button>
                  {canDelete && (
                    <button onClick={() => deleteNote(n.id)} className="muted hover:text-rose-500 p-1 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {count === 0 && <div className="p-8 text-center text-sm muted">لا توجد إشعارات حالياً.</div>}
          </div>
        </div>
      )}
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
    navigator.serviceWorker.ready
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

export function DynamicIsland({ data = { alerts: [], notes: [] } }) {
  const [show, setShow] = useState(false)
  const [text, setText] = useState('')
  const [count, setCount] = useState(0)
  const prev = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    const dismissed = readDismissed()
    const alerts = (data.alerts || []).filter((a) => !dismissed.alerts.includes(a.department))
    const notes = (data.notes || []).filter((n) => !dismissed.notes.includes(n.id))
    const n = alerts.length + notes.length
    const pop = () => {
      const first = notes[0]
      setText(first ? first.message.slice(0, 28) : `${n} إشعار`)
      setCount(n)
      setShow(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setShow(false), 5000)
    }
    if (prev.current === null) {
      if (n > 0) pop()
    } else if (n > prev.current) pop()
    prev.current = n
    return () => clearTimeout(timer.current)
  }, [data])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: -16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] cursor-pointer select-none"
          onClick={() => {
            clearTimeout(timer.current)
            setShow(false)
          }}
          dir="rtl"
        >
          <div className="bg-black/90 backdrop-blur-xl rounded-full px-5 py-2.5 flex items-center gap-4 shadow-2xl border border-white/10 min-w-[200px]">
            <span className="bg-emerald-400 text-black text-[11px] font-extrabold px-3 py-[3px] rounded-full whitespace-nowrap shrink-0">
              {count} {count === 1 ? 'إشعار' : 'إشعارات'}
            </span>
            <span className="text-emerald-400 font-bold text-sm tracking-wide truncate flex-1 text-center">{text || 'Nutri'}</span>
            <span className="text-emerald-400 font-black text-sm tracking-widest shrink-0 font-mono">Nutri</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

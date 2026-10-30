// New page (not in production): supervisor manages departments stored in the DB.
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { Building2, Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { Alert, Modal, ModalButtons, PageHeader, TextField } from '@/components/forms'
import { useAuth } from '@/lib/useAuth'
import { invalidateDepartments } from '@/lib/useDepartments'
import { PERMS } from '@/lib/roles'
import { COLOR_NAMES, DEPT_COLORS, colorClasses, roomsSummary } from '@/lib/departments'

const EMPTY = { name: '', color: 'emerald', roomFrom: '', roomTo: '', extraRooms: '' }

async function send(method, body) {
  const r = await fetch('/api/departments', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await r.json().catch(() => ({}))
  return { ok: r.ok, ...d }
}

export default function Departments() {
  const { user, loading } = useAuth({ requirePerm: PERMS.MANAGE_USERS })
  const [list, setList] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [warning, setWarning] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = () =>
    fetch('/api/departments?all=1')
      .then((r) => r.json())
      .then((d) => setList(d.departments || []))
      .catch(() => {})

  useEffect(() => {
    if (user) load()
  }, [user])

  if (loading || !user) return <Spinner />

  const changed = () => {
    invalidateDepartments()
    load()
  }
  const flash = (msg, warnings = []) => {
    setError('')
    setSuccess(msg)
    setWarning(warnings.join(' — '))
    setTimeout(() => setSuccess(''), 2500)
  }

  const add = async (e) => {
    e.preventDefault()
    setError('')
    setWarning('')
    setBusy(true)
    try {
      const d = await send('POST', form)
      if (d.ok) {
        flash('تمت إضافة القسم بنجاح', d.warnings)
        setForm(EMPTY)
        changed()
      } else setError(d.error || 'تعذّر إضافة القسم')
    } catch {
      setError('خطأ في الاتصال بالشبكة')
    } finally {
      setBusy(false)
    }
  }

  const move = async (index, dir) => {
    const next = [...list]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setList(next)
    const d = await send('PUT', { order: next.map((x) => x.id) })
    if (!d.ok) setError(d.error || 'تعذّر تغيير الترتيب')
    changed()
  }

  const remove = async (dept) => {
    if (!confirm(`هل تريد حذف "${dept.name}"؟\nإذا كانت هناك طلبات مسجلة لهذا القسم فسيتم إيقافه بدلاً من حذفه.`)) return
    const r = await fetch('/api/departments?id=' + encodeURIComponent(dept.id), { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (r.ok) {
      flash(d.deactivated ? 'القسم مرتبط بطلبات سابقة، فتم إيقافه بدلاً من حذفه' : 'تم حذف القسم')
      changed()
    } else setError(d.error || 'تعذّر الحذف')
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>إدارة الأقسام | قسم خدمات التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-nav space-y-6">
        <PageHeader icon={Building2} title="إدارة الأقسام" subtitle="إضافة الأقسام وتحديد ألوانها وأرقام غرفها (متاح للمشرف)" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={add} className="card rounded-3xl p-6 space-y-4 h-fit">
            <h3 className="font-bold flex items-center gap-2">
              <Plus size={18} /> إضافة قسم جديد
            </h3>
            <DeptFields value={form} onChange={setForm} />
            <Alert>{error}</Alert>
            <Alert kind="success">{success}</Alert>
            <Alert kind="warning">{warning}</Alert>
            <button
              disabled={busy}
              className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60"
            >
              إضافة
            </button>
          </form>
          <div className="card rounded-3xl p-6">
            <h3 className="font-bold mb-4">الأقسام ({list.length})</h3>
            <div className="space-y-2">
              {list.map((d, i) => {
                const c = colorClasses(d.color)
                return (
                  <div key={d.id} className={`flex items-center justify-between gap-2 p-3 card-2 rounded-xl ${d.active ? '' : 'opacity-60'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.soft}`}>
                        <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                      </div>
                      <div className="leading-tight min-w-0">
                        <p className="text-sm font-medium truncate">
                          {d.name}
                          {!d.active && <span className="text-[10px] mr-2 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400">غير مفعّل</span>}
                        </p>
                        <p className="text-xs muted">{roomsSummary(d)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <IconBtn title="نقل للأعلى" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ChevronUp size={15} />
                      </IconBtn>
                      <IconBtn title="نقل للأسفل" onClick={() => move(i, 1)} disabled={i === list.length - 1}>
                        <ChevronDown size={15} />
                      </IconBtn>
                      <button
                        onClick={() => setEditing(d)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sky-500/15 text-sky-400 transition-colors"
                        title="تعديل"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(d)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-500/15 text-rose-400 transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
      {editing && (
        <EditDept
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={(warnings) => {
            setEditing(null)
            flash('تم حفظ التعديلات', warnings)
            changed()
          }}
        />
      )}
    </div>
  )
}

function IconBtn({ children, ...rest }) {
  return (
    <button
      className="w-8 h-8 flex items-center justify-center rounded-lg muted hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors disabled:opacity-30 disabled:pointer-events-none"
      {...rest}
    >
      {children}
    </button>
  )
}

function DeptFields({ value, onChange, withActive = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <>
      <TextField label="اسم القسم" value={value.name} onChange={(v) => set('name', v)} placeholder="مثال: قسم الولادة ٤" />
      <div className="space-y-2">
        <label className="text-sm muted">اللون</label>
        <div className="grid grid-cols-6 gap-2">
          {DEPT_COLORS.map((c) => {
            const on = value.color === c
            return (
              <button
                key={c}
                type="button"
                title={COLOR_NAMES[c]}
                onClick={() => set('color', c)}
                className={`h-9 rounded-xl flex items-center justify-center border transition-colors ${
                  on ? 'border-emerald-500 ring-2 ring-emerald-500/40' : 'border-transparent card-2'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${colorClasses(c).dot}`}>
                  {on && <Check size={12} className="text-white" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="من غرفة" type="number" min="1" max="9999" value={value.roomFrom} onChange={(v) => set('roomFrom', v)} placeholder="101" />
        <TextField label="إلى غرفة" type="number" min="1" max="9999" value={value.roomTo} onChange={(v) => set('roomTo', v)} placeholder="125" />
      </div>
      <TextField
        label="غرف إضافية (اختياري)"
        value={value.extraRooms}
        onChange={(v) => set('extraRooms', v)}
        placeholder="مثال: 201, 205-207"
      />
      {withActive && (
        <button
          type="button"
          onClick={() => set('active', !value.active)}
          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
            value.active ? 'bg-emerald-600 border-emerald-500 text-white' : 'card-2'
          }`}
        >
          <span className="text-sm font-medium">مفعّل</span>
          <span className={`text-xs ${value.active ? 'text-white/80' : 'muted'}`}>
            {value.active ? 'يظهر في إدخال الطلبات والمؤشرات' : 'موقوف — يبقى في السجل فقط'}
          </span>
        </button>
      )}
    </>
  )
}

function EditDept({ target, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: target.name,
    color: target.color,
    roomFrom: String(target.roomFrom),
    roomTo: String(target.roomTo),
    extraRooms: (target.extraRooms || []).join(', '),
    active: target.active,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const d = await send('PUT', { id: target.id, ...form })
      if (d.ok) onSaved(d.warnings || [])
      else setError(d.error || 'تعذّر التعديل')
    } catch {
      setError('خطأ في الاتصال بالشبكة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`تعديل: ${target.name}`} icon={<Pencil size={18} className="text-sky-400" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <DeptFields value={form} onChange={setForm} withActive />
        <Alert>{error}</Alert>
        <ModalButtons onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import Head from 'next/head'
import { ClipboardEdit, Download, Pencil, ShieldCheck, Trash2, User, UserPlus, Users as UsersIcon } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { Alert, Modal, ModalButtons, PageHeader, TextField } from '@/components/forms'
import { useAuth } from '@/lib/useAuth'
import { PERMS, ROLE_LIST, roleName } from '@/lib/roles'

const ROLE_ICONS = { supervisor: ShieldCheck, distributor: ClipboardEdit, specialist: Download }
const ROLE_COLORS = {
  supervisor: 'bg-amber-500/15 text-amber-500',
  distributor: 'bg-sky-500/15 text-sky-500',
  specialist: 'bg-violet-500/15 text-violet-500',
}
const EMPTY = { name: '', username: '', password: '', role: 'distributor' }

export default function Users() {
  const { user, loading } = useAuth({ requirePerm: PERMS.MANAGE_USERS })
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = () =>
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {})

  useEffect(() => {
    if (user) load()
  }, [user])

  if (loading || !user) return <Spinner />

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const flash = (msg, ok = true) => {
    if (ok) {
      setSuccess(msg)
      setTimeout(() => setSuccess(''), 2500)
    } else setError(msg)
  }

  const add = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (r.ok) {
        flash('تمت إضافة المستخدم بنجاح')
        setForm(EMPTY)
        load()
      } else flash(d.error || 'تعذّر إضافة المستخدم', false)
    } catch {
      flash('خطأ في الاتصال بالشبكة', false)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (u) => {
    if (!confirm(`هل تريد حذف "${u.name}"؟`)) return
    const r = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok) {
      flash('تم حذف المستخدم')
      load()
    } else flash(d.error || 'تعذّر الحذف', false)
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>إدارة الموظفين | قسم التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <PageHeader icon={UsersIcon} title="إدارة الموظفين والصلاحيات" subtitle="إضافة حسابات الموظفين وتحديد صلاحياتهم (متاح للمشرف)" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={add} className="card rounded-3xl p-6 space-y-4 h-fit">
            <h3 className="font-bold flex items-center gap-2">
              <UserPlus size={18} /> إضافة مستخدم جديد
            </h3>
            <TextField label="الاسم" value={form.name} onChange={(v) => set('name', v)} placeholder="الاسم الكامل" />
            <TextField label="اسم المستخدم" value={form.username} onChange={(v) => set('username', v)} placeholder="للدخول" autoComplete="off" />
            <TextField
              label="كلمة المرور"
              type="password"
              value={form.password}
              onChange={(v) => set('password', v)}
              placeholder="٦ أحرف على الأقل"
              autoComplete="new-password"
            />
            <RolePicker value={form.role} onChange={(v) => set('role', v)} />
            <Alert>{error}</Alert>
            <Alert kind="success">{success}</Alert>
            <button
              disabled={busy}
              className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60"
            >
              إضافة
            </button>
          </form>
          <div className="card rounded-3xl p-6">
            <h3 className="font-bold mb-4">المستخدمون ({users.length})</h3>
            <div className="space-y-2">
              {users.map((u) => {
                const Icon = ROLE_ICONS[u.role] || User
                return (
                  <div key={u.id} className="flex items-center justify-between p-3 card-2 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ROLE_COLORS[u.role] || ''}`}>
                        <Icon size={18} />
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs muted font-mono">{u.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${ROLE_COLORS[u.role] || ''}`}>{roleName(u.role)}</span>
                      <button
                        onClick={() => setEditing(u)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sky-500/15 text-sky-400 transition-colors"
                        title="تعديل"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(u)}
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
        <EditUser
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function EditUser({ target, onClose, onSaved }) {
  const [form, setForm] = useState({ name: target.name, role: target.role, password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password && form.password.length < 6) return setError('كلمة المرور يجب أن تكون ٦ أحرف على الأقل')
    setBusy(true)
    try {
      const r = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, name: form.name, role: form.role, password: form.password || undefined }),
      })
      const d = await r.json()
      if (r.ok) onSaved()
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
        <TextField label="الاسم" value={form.name} onChange={(v) => set('name', v)} placeholder="الاسم الكامل" />
        <TextField
          label="كلمة المرور الجديدة"
          type="password"
          value={form.password}
          onChange={(v) => set('password', v)}
          placeholder="اتركه فارغاً للإبقاء على الحالية"
          autoComplete="new-password"
        />
        <RolePicker value={form.role} onChange={(v) => set('role', v)} />
        <Alert>{error}</Alert>
        <ModalButtons onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  )
}

function RolePicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-sm muted">الصلاحية</label>
      <div className="space-y-2">
        {ROLE_LIST.map((r) => {
          const Icon = ROLE_ICONS[r.id] || User
          const on = value === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-colors ${
                on ? 'bg-emerald-600 border-emerald-500 text-white' : 'card-2 hover:border-emerald-500/40'
              }`}
            >
              <Icon size={18} />
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className={`text-xs ${on ? 'text-white/80' : 'muted'}`}>{r.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

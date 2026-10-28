// Small form pieces shared by the /users and /departments pages.
import { X } from 'lucide-react'

export function TextField({ label, value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <div className="space-y-2">
      <label className="text-sm muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full field rounded-xl p-3"
        {...rest}
      />
    </div>
  )
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null
  const cls =
    kind === 'success'
      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      : kind === 'warning'
        ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  return <div className={`text-sm border rounded-xl p-3 text-center ${cls}`}>{children}</div>
}

export function Modal({ title, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card rounded-3xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ModalButtons({ onCancel, busy }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
        إلغاء
      </button>
      <button
        disabled={busy}
        className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60"
      >
        حفظ
      </button>
    </div>
  )
}

export function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-emerald-600/15 text-emerald-500 rounded-xl flex items-center justify-center">
          <Icon size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

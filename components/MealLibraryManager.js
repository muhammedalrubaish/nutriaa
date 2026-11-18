// Modal/sheet to add or hide meals in the searchable menu pickers (meal_library).
import { useMemo, useState } from 'react'
import { Library, Plus, Search, Trash2, Utensils, X } from 'lucide-react'
import { Alert } from '@/components/forms'
import {
  MEAL_CATEGORY_LABELS,
  MEAL_CATEGORY_OPTIONS,
  filterMealLibrary,
  groupMealLibrary,
} from '@/lib/mealLibrary'

const FILTERS = [
  { id: 'all', name: 'الكل' },
  { id: 'main', name: 'أساسية' },
  { id: 'optional', name: 'اختيارية' },
]

export default function MealLibraryManager({ meals, onChange, onClose }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('main')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const groups = useMemo(
    () => groupMealLibrary(filterMealLibrary(meals, { category: filter, query })),
    [meals, filter, query],
  )
  const total = groups.reduce((n, g) => n + g.items.length, 0)

  const add = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('اكتب اسم الوجبة')
    setError('')
    setBusy(true)
    try {
      const r = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, category }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error || 'تعذّر إضافة الوجبة')
        return
      }
      setName('')
      await onChange()
    } catch {
      setError('خطأ في الاتصال بالشبكة')
    } finally {
      setBusy(false)
    }
  }

  const hide = async (meal) => {
    if (!confirm(`هل تريد إخفاء "${meal.name}" من القائمة المنسدلة؟`)) return
    setError('')
    setBusy(true)
    try {
      const r = await fetch('/api/meals?id=' + encodeURIComponent(meal.id), { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error || 'تعذّر إخفاء الوجبة')
        return
      }
      await onChange()
    } catch {
      setError('خطأ في الاتصال بالشبكة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="meal-library-title"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <h3 id="meal-library-title" className="font-bold text-lg flex items-center gap-2">
            <Library size={18} className="text-emerald-500" />
            إدارة الوجبات
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="إغلاق">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm muted -mt-2">أضف وجبات للقائمة المنسدلة أو أخفِ ما لا تحتاجه. الوجبة المخفاة تختفي من الاختيار فوراً.</p>

        <form onSubmit={add} className="card-2 rounded-2xl p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_8.5rem] gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الوجبة الجديدة"
              maxLength={200}
              className="w-full field rounded-xl p-2.5 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full field rounded-xl p-2.5 text-sm"
            >
              {MEAL_CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60"
          >
            <Plus size={16} /> إضافة
          </button>
        </form>

        <div className="relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في الوجبات..."
            className="w-full field rounded-xl p-2.5 pr-8 text-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                filter === f.id ? 'bg-emerald-600 text-white' : 'card-2 hover:border-emerald-500/40'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        <Alert>{error}</Alert>

        {total === 0 ? (
          <p className="text-sm muted text-center py-6">لا توجد وجبات مطابقة</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.id} className="space-y-2">
                <h4 className="text-xs font-bold muted flex items-center gap-1">
                  <Utensils size={12} />
                  {g.name} ({g.items.length})
                </h4>
                <ul className="space-y-1.5">
                  {g.items.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 p-2.5 card-2 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        {filter === 'all' ? null : m.category === 'any' ? (
                          <p className="text-[11px] muted">{MEAL_CATEGORY_LABELS.any}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => hide(m)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-500/15 text-rose-400 transition-colors shrink-0 disabled:opacity-50"
                        title="إخفاء من القائمة المنسدلة"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

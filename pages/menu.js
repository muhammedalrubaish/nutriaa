import { useEffect, useState } from 'react'
import Head from 'next/head'
import { CalendarDays, Coffee, Save, Utensils } from 'lucide-react'
import Nav from '@/components/Nav'
import Spinner from '@/components/Spinner'
import { useAuth } from '@/lib/useAuth'
import { can, PERMS } from '@/lib/roles'
import { MAIN_MEALS, OPTIONAL_ITEMS, WEEK_DAYS } from '@/lib/constants'

export default function Menu() {
  const { user, loading } = useAuth({ requirePerm: PERMS.CREATE_ORDERS })
  const [menu, setMenu] = useState(null)
  const [status, setStatus] = useState('idle')
  const editable = can(user?.role, PERMS.EDIT_MENU)

  useEffect(() => {
    if (!user) return
    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => setMenu(d.menu))
      .catch(() => {})
  }, [user])

  if (loading || !user || !menu) return <Spinner />

  const set = (day, k, v) => setMenu((m) => ({ ...m, [day]: { ...m[day], [k]: v } }))
  const save = async () => {
    setStatus('saving')
    try {
      const r = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu }),
      })
      setStatus(r.ok ? 'saved' : 'idle')
      if (r.ok) setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>القائمة الأسبوعية | قسم التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav user={user} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-600/15 text-emerald-500 rounded-xl flex items-center justify-center">
              <CalendarDays size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">القائمة الأسبوعية</h2>
              <p className="text-sm muted">لكل يوم وجبة أساسية واحدة وإضافة اختيارية واحدة ثابتة</p>
            </div>
          </div>
          {editable && (
            <button
              onClick={save}
              disabled={status === 'saving'}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-colors ${
                status === 'saved' ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Save size={18} />
              {status === 'saving' ? 'جارٍ الحفظ...' : status === 'saved' ? 'تم الحفظ' : 'حفظ القائمة'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEK_DAYS.map((d) => (
            <div key={d.id} className="card rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-600/15 text-emerald-500 flex items-center justify-center text-sm font-bold">
                  {d.name[0]}
                </span>
                <h3 className="font-bold">{d.name}</h3>
              </div>
              <MenuField
                icon={<Utensils size={12} className="text-emerald-500" />}
                label=" الوجبة الأساسية"
                editable={editable}
                listId={`main-${d.id}`}
                options={MAIN_MEALS}
                value={menu[d.id]?.mainMeal || ''}
                onChange={(v) => set(d.id, 'mainMeal', v)}
              />
              <MenuField
                icon={<Coffee size={12} className="text-sky-500" />}
                label=" الإضافة الاختيارية"
                editable={editable}
                listId={`opt-${d.id}`}
                options={OPTIONAL_ITEMS}
                value={menu[d.id]?.optionalItem || ''}
                onChange={(v) => set(d.id, 'optionalItem', v)}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function MenuField({ icon, label, editable, listId, options, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-xs muted flex items-center gap-1">
        {icon}
        {label}
      </label>
      {editable ? (
        <>
          <input
            type="text"
            list={listId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="اكتب أو اختر..."
            className="w-full field rounded-xl p-2.5 text-sm"
          />
          <datalist id={listId}>
            {options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      ) : (
        <p className="card-2 rounded-xl p-2.5 text-sm font-medium">{value || '—'}</p>
      )}
    </div>
  )
}

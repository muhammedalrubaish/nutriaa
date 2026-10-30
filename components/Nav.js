import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Building2, CalendarDays, ClipboardEdit, FileSpreadsheet, LayoutDashboard, ListChecks, LogOut, Users,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { DynamicIsland, NotificationsBell, PushToggle } from './notifications'
import { can, PERMS } from '@/lib/roles'
import { clearAuthCache } from '@/lib/useAuth'
import { invalidateDepartments } from '@/lib/useDepartments'

const ITEMS = [
  { href: '/', label: 'المؤشرات', icon: LayoutDashboard, perm: PERMS.VIEW_REPORTS },
  { href: '/orders', label: 'إدخال طلب', icon: ClipboardEdit, perm: PERMS.CREATE_ORDERS },
  { href: '/list', label: 'السجل', icon: ListChecks, perm: PERMS.VIEW_REPORTS },
  { href: '/menu', label: 'القائمة', icon: CalendarDays, perm: PERMS.CREATE_ORDERS },
  { href: '/import', label: 'استيراد', icon: FileSpreadsheet, perm: PERMS.MANAGE_USERS },
  { href: '/users', label: 'الموظفون', icon: Users, perm: PERMS.MANAGE_USERS },
  { href: '/departments', label: 'الأقسام', icon: Building2, perm: PERMS.MANAGE_USERS },
]

// Kept across client-side navigations so the bell doesn't flash empty on every page.
let cachedNotifs = null

export default function Nav({ user }) {
  const router = useRouter()
  const [data, setData] = useState(cachedNotifs)

  useEffect(() => {
    const load = () =>
      fetch('/api/notifications')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return
          cachedNotifs = d
          setData(d)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const updateData = (fn) => setData((d) => (cachedNotifs = fn(d)))

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
    cachedNotifs = null
    clearAuthCache()
    invalidateDepartments()
    router.replace('/login')
  }

  const items = ITEMS.filter((i) => can(user?.role, i.perm))

  return (
    <>
      <DynamicIsland data={data} />
      <header className="sticky top-0 z-30 card border-x-0 border-t-0 backdrop-blur-xl" dir="rtl">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/qhc-logo.jpeg" alt="تجمع القصيم الصحي" className="h-9 w-9 rounded-lg object-cover shrink-0" />
            <div className="leading-tight min-w-0">
              <p className="text-sm font-extrabold text-emerald-400 truncate">قسم خدمات التغذية</p>
              <p className="text-[10px] muted truncate">مستشفى الولادة والأطفال ببريدة</p>
            </div>
          </div>
          {/* The bottom nav already marks the current page; on phones the centred title collided with the brand. */}
          <p className="hidden md:block absolute left-1/2 -translate-x-1/2 text-sm font-bold">
            {items.find((i) => i.href === router.pathname)?.label || ''}
          </p>
          <div className="flex items-center gap-0.5 shrink-0">
            <PushToggle />
            <NotificationsBell user={user} data={data} setData={updateData} />
            <ThemeToggle />
            <button
              onClick={logout}
              title="تسجيل الخروج"
              className="p-2 rounded-xl muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>
      <nav className="fixed bottom-0 inset-x-0 z-30 card border-x-0 border-b-0 backdrop-blur-xl pb-safe" dir="rtl">
        <div className="max-w-6xl mx-auto flex items-stretch justify-around">
          {items.map((i) => {
            const Icon = i.icon
            const active = router.pathname === i.href
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 px-1 sm:px-3 flex-1 min-w-0 transition-colors ${
                  active ? 'text-emerald-400' : 'muted hover:text-emerald-400'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-emerald-500/15' : ''}`}>
                  <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                </div>
                <span className={`text-[10px] whitespace-nowrap ${active ? 'font-bold' : 'font-medium'}`}>{i.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

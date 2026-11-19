import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Building2, CalendarDays, ClipboardEdit, FileSpreadsheet, Info, LayoutDashboard, ListChecks, LogOut, MoreHorizontal, Users,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { DynamicIsland, NotificationsBell, PushToggle } from './notifications'
import { can, PERMS } from '@/lib/roles'
import { APP_SUBTITLE, APP_TITLE } from '@/lib/constants'
import { clearAuthCache } from '@/lib/useAuth'
import { invalidateDepartments } from '@/lib/useDepartments'
import { useLive } from '@/lib/useLive'
import { splitNav } from '@/lib/nav'

const ITEMS = [
  { href: '/', label: 'المؤشرات', icon: LayoutDashboard, perm: PERMS.VIEW_DASHBOARD },
  { href: '/orders', label: 'إدخال طلب', icon: ClipboardEdit, perm: PERMS.CREATE_ORDERS },
  { href: '/list', label: 'السجل', icon: ListChecks, perm: PERMS.VIEW_REPORTS },
  { href: '/menu', label: 'القائمة', icon: CalendarDays, perm: PERMS.CREATE_ORDERS },
  { href: '/import', label: 'استيراد', icon: FileSpreadsheet, perm: PERMS.MANAGE_USERS },
  { href: '/users', label: 'الموظفون', icon: Users, perm: PERMS.MANAGE_USERS },
  { href: '/departments', label: 'الأقسام', icon: Building2, perm: PERMS.MANAGE_USERS },
  { href: '/about', label: 'عن النظام', icon: Info, perm: null },
]

// Kept across client-side navigations so the bell doesn't flash empty on every page.
let cachedNotifs = null

export default function Nav({ user }) {
  const router = useRouter()
  const [data, setData] = useState(cachedNotifs)
  const [moreOpen, setMoreOpen] = useState(false)

  const load = () =>
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        cachedNotifs = d
        setData(d)
      })
      .catch(() => {})

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])
  // Note 10: refresh the bell as soon as anything changes.
  useLive(load)

  useEffect(() => setMoreOpen(false), [router.pathname])

  const updateData = (fn) => setData((d) => (cachedNotifs = fn(d)))

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
    cachedNotifs = null
    clearAuthCache()
    invalidateDepartments()
    router.replace('/login')
  }

  const items = ITEMS.filter((i) => !i.perm || can(user?.role, i.perm))
  const { shown, more } = splitNav(items)
  const moreActive = more.some((i) => i.href === router.pathname)

  return (
    <>
      <DynamicIsland data={data} />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-l from-navy to-navy-700 text-white shadow-lg shadow-navy/20" dir="rtl">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <Link href="/about" className="flex items-center gap-2.5 min-w-0" title="عن النظام">
            <img src="/qhc-logo.jpeg" alt="تجمع القصيم الصحي" className="h-9 w-9 rounded-lg object-cover shrink-0 bg-white" />
            <div className="leading-tight min-w-0">
              {/* Wraps on narrow phones instead of being cut off. */}
              <p className="text-[13px] sm:text-sm font-extrabold text-white break-words">{APP_TITLE}</p>
              <p className="text-[10px] text-sky-200 truncate">{APP_SUBTITLE}</p>
            </div>
          </Link>
          {/* Desktop: every page in the header. Phones use the bottom bar. */}
          <nav className="hidden lg:flex items-center gap-1">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                  router.pathname === i.href ? 'bg-sky-600 text-white' : 'text-sky-100 hover:bg-white/10'
                }`}
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-0.5 shrink-0 [&_button]:text-sky-100">
            <PushToggle />
            <NotificationsBell user={user} data={data} setData={updateData} />
            <ThemeToggle />
            <button
              onClick={logout}
              title="تسجيل الخروج"
              className="p-2 rounded-xl hover:text-rose-300 hover:bg-white/10 transition-colors"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>
      {moreOpen && (
        <>
          <button aria-label="إغلاق" className="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="lg:hidden fixed inset-x-2 z-40 card rounded-2xl shadow-2xl p-1.5 grid gap-0.5 bottom-[calc(var(--nav-real,calc(4.6rem+env(safe-area-inset-bottom,0px)))+var(--footer-real,0px))]" role="menu" dir="rtl">
            {more.map((i) => {
              const Icon = i.icon
              const active = router.pathname === i.href
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  role="menuitem"
                  className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm ${active ? 'text-sky-500 bg-sky-500/10' : 'hover:bg-sky-500/10'}`}
                >
                  <Icon size={19} /> {i.label}
                </Link>
              )
            })}
          </div>
        </>
      )}
      <nav data-bottom-nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 card border-x-0 border-b-0 backdrop-blur-xl pb-safe" dir="rtl">
        <div className="max-w-6xl mx-auto flex items-stretch justify-around">
          {shown.map((i) => (
            <Tab key={i.href} item={i} active={router.pathname === i.href} />
          ))}
          {more.length > 0 && (
            <button
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className={`flex flex-col items-center gap-0.5 py-2.5 px-1 flex-1 min-w-0 transition-colors ${
                moreActive || moreOpen ? 'text-sky-500' : 'muted hover:text-sky-500'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${moreActive || moreOpen ? 'bg-sky-500/15' : ''}`}>
                <MoreHorizontal size={21} />
              </div>
              <span className="text-[10px] font-bold whitespace-nowrap">المزيد</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}

function Tab({ item, active }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-0.5 py-2.5 px-1 sm:px-3 flex-1 min-w-0 transition-colors ${
        active ? 'text-sky-500' : 'muted hover:text-sky-500'
      }`}
    >
      <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-sky-500/15' : ''}`}>
        <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
      </div>
      <span className={`text-[10px] whitespace-nowrap ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
    </Link>
  )
}

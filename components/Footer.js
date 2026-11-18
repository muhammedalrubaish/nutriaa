import Link from 'next/link'
import { useRouter } from 'next/router'
import { COPYRIGHT } from '@/lib/constants'

// Copyright line at the end of every page. Pages with the fixed bottom nav get extra room below it.
export default function Footer() {
  const { pathname } = useRouter()
  const hasNav = pathname !== '/login' && pathname !== '/about'
  return (
    <footer className={`app-bg text-center text-xs muted px-4 pt-4 border-t border-token ${hasNav ? 'pb-nav lg:pb-4' : 'pb-4'}`} dir="rtl">
      <p>{COPYRIGHT}</p>
      <Link href="/about" className="inline-block mt-1 text-sky-500 hover:underline print:hidden">
        عن النظام
      </Link>
    </footer>
  )
}

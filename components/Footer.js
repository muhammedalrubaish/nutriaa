import { useRouter } from 'next/router'
import { COPYRIGHT } from '@/lib/constants'

// Copyright line at the end of every page. Pages with the fixed bottom nav get extra room below it.
export default function Footer() {
  const { pathname } = useRouter()
  const hasNav = pathname !== '/login'
  return (
    <footer className={`app-bg text-center text-xs muted px-4 pt-4 border-t border-token ${hasNav ? 'pb-nav' : 'pb-4'}`} dir="rtl">
      {COPYRIGHT}
    </footer>
  )
}

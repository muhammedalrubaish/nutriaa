import { useCallback, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

function applyTheme(t) {
  if (typeof document === 'undefined') return
  const r = document.documentElement
  t === 'dark' ? r.classList.add('dark') : r.classList.remove('dark')
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    let t = 'dark'
    try {
      t = localStorage.getItem('theme') || 'dark'
    } catch {}
    setTheme(t)
    applyTheme(t)
  }, [])

  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next = cur === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      try {
        localStorage.setItem('theme', next)
      } catch {}
      return next
    })
  }, [])

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
      className="p-2 rounded-xl muted hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

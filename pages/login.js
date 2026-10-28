import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { LogIn } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { homeFor } from '@/lib/roles'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const d = await r.json()
      if (r.ok) router.replace(homeFor(d.user.role))
      else setError(d.error || 'تعذّر تسجيل الدخول')
    } catch {
      setError('خطأ في الاتصال بالشبكة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-6" dir="rtl">
      <Head>
        <title>تسجيل الدخول | قسم التغذية</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/qhc-logo.jpeg"
            alt="تجمع القصيم الصحي"
            className="w-24 h-24 rounded-2xl object-cover shadow-xl shadow-black/30 mb-4"
          />
          <h1 className="text-2xl font-bold">نظام إدارة التغذية</h1>
          <p className="text-sm muted mt-1">تجمع القصيم الصحي</p>
        </div>
        <form onSubmit={submit} className="card rounded-3xl p-7 space-y-5 backdrop-blur-xl">
          <div className="space-y-2">
            <label className="text-sm muted">اسم المستخدم</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full field rounded-xl p-3 transition-colors"
              placeholder="اسم المستخدم"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm muted">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full field rounded-xl p-3 transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">{error}</div>
          )}
          <button
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} /> دخول
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

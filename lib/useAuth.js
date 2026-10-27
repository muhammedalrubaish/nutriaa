import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { can, homeFor } from './roles'

let cachedUser = null

export function clearAuthCache() {
  cachedUser = null
}

export function useAuth({ redirectTo = '/login', requirePerm = null } = {}) {
  const [user, setUser] = useState(cachedUser)
  const [loading, setLoading] = useState(!cachedUser)
  const router = useRouter()

  useEffect(() => {
    if (cachedUser) {
      if (requirePerm && !can(cachedUser.role, requirePerm)) router.replace(homeFor(cachedUser.role))
      return
    }
    let alive = true
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return
        if (!data?.user) {
          router.replace(redirectTo)
          return
        }
        if (requirePerm && !can(data.user.role, requirePerm)) {
          router.replace(homeFor(data.user.role))
          return
        }
        cachedUser = data.user
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => alive && router.replace(redirectTo))
    return () => {
      alive = false
    }
  }, [])

  return { user, loading }
}

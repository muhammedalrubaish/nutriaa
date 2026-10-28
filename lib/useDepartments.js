// Client hook replacing the old hardcoded DEPARTMENTS constant.
// Cached per page load like useAuth; call invalidateDepartments() after edits.
import { useEffect, useMemo, useState } from 'react'

const EMPTY = []
const cache = { active: null, all: null }
const inflight = { active: null, all: null }

export function invalidateDepartments() {
  cache.active = cache.all = null
  inflight.active = inflight.all = null
}

function load(key) {
  if (!inflight[key]) {
    inflight[key] = fetch('/api/departments' + (key === 'all' ? '?all=1' : ''))
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then((d) => (cache[key] = d.departments || []))
      .catch(() => {
        inflight[key] = null
        return []
      })
  }
  return inflight[key]
}

/** { departments, byId, loading }. `all` also includes inactive departments. */
export function useDepartments({ all = false, enabled = true } = {}) {
  const key = all ? 'all' : 'active'
  const [list, setList] = useState(cache[key])
  useEffect(() => {
    if (!enabled) return
    let alive = true
    load(key).then((d) => alive && setList(d))
    return () => {
      alive = false
    }
  }, [key, enabled])
  const departments = list || EMPTY
  const byId = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d])), [departments])
  return { departments, byId, loading: !list }
}

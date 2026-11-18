import { describe, it, expect } from 'vitest'
import {
  isNewVersion, canReload, markReload, isBusy, decideAction,
  RELOAD_GUARD_KEY, RELOAD_GUARD_MS, MAX_DEFER_MS, RECENT_TYPING_MS,
} from '@/lib/appUpdate'

function memStore() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }
}

describe('isNewVersion', () => {
  it('detects a different deployed version', () => {
    expect(isNewVersion('abc', 'def')).toBe(true)
    expect(isNewVersion(' abc ', 'abc')).toBe(false)
  })
  it('never triggers on unknown, empty or dev versions', () => {
    expect(isNewVersion('', 'def')).toBe(false)
    expect(isNewVersion('abc', '')).toBe(false)
    expect(isNewVersion('abc', undefined)).toBe(false)
    expect(isNewVersion('dev', 'def')).toBe(false)
    expect(isNewVersion('abc', 'dev')).toBe(false)
  })
})

describe('reload loop guard', () => {
  it('allows the first reload, blocks a repeat for the same version within 30s', () => {
    const s = memStore()
    expect(canReload(s, 'v2', 1000)).toBe(true)
    markReload(s, 'v2', 1000)
    expect(canReload(s, 'v2', 1000 + RELOAD_GUARD_MS - 1)).toBe(false)
    expect(canReload(s, 'v2', 1000 + RELOAD_GUARD_MS)).toBe(true)
  })
  it('a newer version is not blocked by the previous guard', () => {
    const s = memStore()
    markReload(s, 'v2', 1000)
    expect(canReload(s, 'v3', 1001)).toBe(true)
  })
  it('tolerates missing/broken storage', () => {
    expect(canReload(null, 'v2')).toBe(true)
    const s = memStore()
    s.setItem(RELOAD_GUARD_KEY, '{not json')
    expect(canReload(s, 'v2')).toBe(true)
    const throwing = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } }
    expect(canReload(throwing, 'v2')).toBe(true)
    expect(() => markReload(throwing, 'v2')).not.toThrow()
  })
})

describe('busy detection and deferral', () => {
  it('is busy while a form field is focused or right after typing', () => {
    expect(isBusy({ activeTag: 'INPUT' })).toBe(true)
    expect(isBusy({ activeTag: 'textarea' })).toBe(true)
    expect(isBusy({ activeTag: 'SELECT' })).toBe(true)
    expect(isBusy({ activeTag: 'DIV', activeEditable: true })).toBe(true)
    expect(isBusy({ activeTag: 'BODY', lastInputAt: 1000, now: 1000 + RECENT_TYPING_MS - 1 })).toBe(true)
    expect(isBusy({ activeTag: 'BODY', lastInputAt: 1000, now: 1000 + RECENT_TYPING_MS })).toBe(false)
    expect(isBusy({ activeTag: 'BUTTON' })).toBe(false)
    expect(isBusy()).toBe(false)
  })
  it('reloads at once when idle, defers when busy, forces after 2 minutes', () => {
    expect(decideAction({ busy: false, detectedAt: 0, now: 5 })).toBe('reload')
    expect(decideAction({ busy: true, detectedAt: 1000, now: 1000 + MAX_DEFER_MS - 1 })).toBe('defer')
    expect(decideAction({ busy: true, detectedAt: 1000, now: 1000 + MAX_DEFER_MS })).toBe('reload')
    expect(MAX_DEFER_MS).toBe(120_000)
  })
})

describe('/api/app-version', () => {
  it('returns the deploy id with no-store and nothing else', async () => {
    const { default: handler } = await import('@/pages/api/app-version')
    const prev = process.env.VERCEL_GIT_COMMIT_SHA
    process.env.VERCEL_GIT_COMMIT_SHA = 'sha123'
    const headers = {}
    let status, body
    const res = {
      setHeader: (k, v) => { headers[k] = v },
      status: (s) => { status = s; return res },
      json: (b) => { body = b; return res },
    }
    handler({ method: 'GET' }, res)
    if (prev === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA
    else process.env.VERCEL_GIT_COMMIT_SHA = prev
    expect(status).toBe(200)
    expect(body).toEqual({ version: 'sha123' })
    expect(headers['Cache-Control']).toMatch(/no-store/)
  })
})

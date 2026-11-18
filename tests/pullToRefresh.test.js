import { describe, it, expect } from 'vitest'
import {
  pullDistance, pullPhase, labelFor, canStartPull, classifyMove, shouldRefresh,
  PULL_THRESHOLD, PULL_MAX, RESISTANCE,
} from '@/lib/pullToRefresh'

describe('pull distance and phase', () => {
  it('maps finger movement with resistance, ignores upward drags, caps at max', () => {
    expect(pullDistance(-20)).toBe(0)
    expect(pullDistance(0)).toBe(0)
    expect(pullDistance(NaN)).toBe(0)
    expect(pullDistance(100)).toBe(Math.round(100 * RESISTANCE))
    expect(pullDistance(10_000)).toBe(PULL_MAX)
  })
  it('arms at ~70px and shows the right Arabic label', () => {
    expect(PULL_THRESHOLD).toBe(70)
    expect(pullPhase(0)).toBe('idle')
    expect(pullPhase(69)).toBe('pull')
    expect(pullPhase(70)).toBe('release')
    expect(labelFor('pull')).toBe('اسحب للتحديث')
    expect(labelFor('release')).toBe('أفلت للتحديث')
    expect(labelFor('refreshing')).toBe('جارٍ التحديث...')
    expect(shouldRefresh(69)).toBe(false)
    expect(shouldRefresh(70)).toBe(true)
    expect(shouldRefresh(pullDistance(Math.ceil(PULL_THRESHOLD / RESISTANCE)))).toBe(true)
  })
})

describe('start guards', () => {
  it('starts only at the top with one finger and nothing in the way', () => {
    expect(canStartPull({ touches: 1, scrollY: 0 })).toBe(true)
    expect(canStartPull({ touches: 1, scrollY: -5 })).toBe(true) // iOS bounce
    expect(canStartPull({ touches: 1, scrollY: 1 })).toBe(false)
    expect(canStartPull({ touches: 2 })).toBe(false)
  })
  it('blocks when a modal is open, a field is focused, an inner scroller is scrolled, or already refreshing', () => {
    expect(canStartPull({ modalOpen: true })).toBe(false)
    expect(canStartPull({ activeTag: 'INPUT' })).toBe(false)
    expect(canStartPull({ activeTag: 'textarea' })).toBe(false)
    expect(canStartPull({ activeTag: 'SELECT' })).toBe(false)
    expect(canStartPull({ activeTag: 'DIV', activeEditable: true })).toBe(false)
    expect(canStartPull({ innerScrolled: true })).toBe(false)
    expect(canStartPull({ refreshing: true })).toBe(false)
    expect(canStartPull({ activeTag: 'BUTTON' })).toBe(true)
  })
})

describe('gesture classification', () => {
  it('waits for movement, cancels horizontal/upward, accepts downward', () => {
    expect(classifyMove(2, 3)).toBe('wait')
    expect(classifyMove(0, -20)).toBe('cancel')
    expect(classifyMove(30, 10)).toBe('cancel')
    expect(classifyMove(5, 30)).toBe('pull')
  })
})

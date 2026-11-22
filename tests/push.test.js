import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendNotification = vi.fn()
const setVapidDetails = vi.fn()
vi.mock('web-push', () => ({ default: { sendNotification: (...a) => sendNotification(...a), setVapidDetails: (...a) => setVapidDetails(...a) } }))
const query = vi.fn()
vi.mock('@/lib/db', () => ({ query: (...a) => query(...a) }))
vi.mock('../lib/db', () => ({ query: (...a) => query(...a) }))

process.env.VAPID_PUBLIC_KEY = 'pub'
process.env.VAPID_PRIVATE_KEY = 'priv'
const { vapidSubject, sendToAll, DEFAULT_SUBJECT } = await import('@/lib/push')

describe('vapidSubject', () => {
  it('keeps a clean mailto: or https: subject', () => {
    expect(vapidSubject('mailto:a@hospital.sa')).toBe('mailto:a@hospital.sa')
    expect(vapidSubject(' https://nutriaa.vercel.app ')).toBe('https://nutriaa.vercel.app')
  })
  it('falls back to the app URL for values Apple rejects', () => {
    for (const bad of ['', 'a@b.com', 'mailto: a@b.com', 'mailto:<a@b.com>', 'mailto:x@nutri.local', 'https://localhost', 'http://x.com'])
      expect(vapidSubject(bad)).toBe(DEFAULT_SUBJECT)
  })
})

describe('sendToAll', () => {
  beforeEach(() => {
    sendNotification.mockReset()
    query.mockReset()
  })
  it('removes 404/410 subscriptions and reports (not swallows) other failures', async () => {
    query.mockImplementation(async (sql) =>
      sql.startsWith('select')
        ? [
            { endpoint: 'https://web.push.apple.com/a', p256dh: 'k', auth: 'a' },
            { endpoint: 'https://fcm.googleapis.com/b', p256dh: 'k', auth: 'a' },
            { endpoint: 'https://web.push.apple.com/c', p256dh: 'k', auth: 'a' },
          ]
        : [],
    )
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 403, body: '{"reason":"BadJwtToken"}' }))
    const r = await sendToAll({ title: 't' })
    expect(r).toEqual({ sent: 1, removed: 1, failed: 1, total: 3 })
    expect(query).toHaveBeenCalledWith('delete from push_subscriptions where endpoint = $1', ['https://web.push.apple.com/a'])
    expect(err.mock.calls.some((c) => c.join(' ').includes('BadJwtToken'))).toBe(true)
    err.mockRestore()
  })
})

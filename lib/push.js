// Web push via VAPID. Degrades to a no-op when the keys are not configured.
import webpush from 'web-push'
import { query } from './db'

let configured = null

// Apple's push service answers 403 BadJwtToken when the JWT subject is not a clean `mailto:` or `https:` URL
// (spaces, angle brackets, localhost/.local hosts). Fall back to the app's own URL in those cases.
export const DEFAULT_SUBJECT = 'https://nutriaa.vercel.app'
export function vapidSubject(raw = process.env.VAPID_SUBJECT) {
  const s = String(raw || '').trim()
  const ok =
    /^mailto:[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/i.test(s) ||
    (/^https:\/\/[^\s<>]+$/i.test(s) && !/^https:\/\/(localhost|127\.|[^/]*\.local)(\/|:|$)/i.test(s))
  if (!ok && s) console.warn('[push] VAPID_SUBJECT is not a valid mailto:/https: value; using the app URL')
  return ok && !/@[^@]*\.local$/i.test(s) ? s : DEFAULT_SUBJECT
}

export function pushEnabled() {
  if (configured !== null) return configured
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (configured = false)
  try {
    webpush.setVapidDetails(vapidSubject(), pub.trim(), priv.trim())
    configured = true
  } catch (e) {
    console.error('[push] invalid VAPID keys', e.message)
    configured = false
  }
  return configured
}

/**
 * Sends a notification to every stored subscription; removes expired ones.
 * `roles` limits it to subscriptions of users with those roles; `userIds` to those accounts;
 * `excludeUserId` skips the sender's own devices.
 */
export async function sendToAll(payload, { roles = null, userIds = null, excludeUserId = null } = {}) {
  if (!pushEnabled()) return { sent: 0, skipped: true }
  const subs = userIds
    ? await query(
        `select s.endpoint, s.p256dh, s.auth from push_subscriptions s
         where s.user_id = any($1) and s.user_id is distinct from $2`,
        [userIds, excludeUserId],
      )
    : roles
    ? await query(
        `select s.endpoint, s.p256dh, s.auth from push_subscriptions s join users u on u.id = s.user_id
         where u.role = any($1) and u.id is distinct from $2`,
        [roles, excludeUserId],
      )
    : await query('select endpoint, p256dh, auth from push_subscriptions')
  const body = JSON.stringify(payload)
  let sent = 0
  let removed = 0
  const failed = []
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600 })
        sent++
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          removed++
          await query('delete from push_subscriptions where endpoint = $1', [s.endpoint]).catch(() => {})
          return
        }
        // Anything else (403 BadJwtToken / VapidPkHashMismatch, 400, 413, 429, network) used to be swallowed,
        // so pushes silently never arrived. Log the push service's status and reason (no keys or endpoints).
        let host = ''
        try { host = new URL(s.endpoint).host } catch {}
        const reason = String(e.body || e.message || '').slice(0, 200)
        failed.push({ host, status: e.statusCode || 0, reason })
        console.error('[push] send failed', host, e.statusCode || '', reason)
      }
    }),
  )
  return { sent, removed, failed: failed.length, total: subs.length }
}

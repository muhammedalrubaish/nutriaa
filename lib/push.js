// Web push via VAPID. Degrades to a no-op when the keys are not configured.
import webpush from 'web-push'
import { query } from './db'

let configured = null

export function pushEnabled() {
  if (configured !== null) return configured
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (configured = false)
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:nutri@example.com', pub, priv)
    configured = true
  } catch (e) {
    console.error('[push] invalid VAPID keys', e.message)
    configured = false
  }
  return configured
}

/**
 * Sends a notification to every stored subscription; removes expired ones.
 * `roles` limits it to subscriptions of users with those roles; `excludeUserId` skips the sender's own devices.
 */
export async function sendToAll(payload, { roles = null, excludeUserId = null } = {}) {
  if (!pushEnabled()) return { sent: 0, skipped: true }
  const subs = roles
    ? await query(
        `select s.endpoint, s.p256dh, s.auth from push_subscriptions s join users u on u.id = s.user_id
         where u.role = any($1) and u.id is distinct from $2`,
        [roles, excludeUserId],
      )
    : await query('select endpoint, p256dh, auth from push_subscriptions')
  const body = JSON.stringify(payload)
  let sent = 0
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600 })
        sent++
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410)
          await query('delete from push_subscriptions where endpoint = $1', [s.endpoint]).catch(() => {})
      }
    }),
  )
  return { sent }
}

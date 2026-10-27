import { query } from '@/lib/db'
import { route } from '@/lib/api'

export default route({
  POST: {
    handle: async (req, res, user) => {
      const sub = req.body?.subscription
      const endpoint = sub?.endpoint
      const p256dh = sub?.keys?.p256dh
      const auth = sub?.keys?.auth
      if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || !p256dh || !auth)
        return res.status(400).json({ error: 'اشتراك غير صالح' })
      await query(
        `insert into push_subscriptions (endpoint, p256dh, auth, user_id) values ($1,$2,$3,$4)
         on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id`,
        [endpoint, String(p256dh), String(auth), user.id],
      )
      return res.status(200).json({ ok: true })
    },
  },
  DELETE: {
    handle: async (req, res) => {
      const endpoint = req.body?.endpoint
      if (typeof endpoint === 'string') await query('delete from push_subscriptions where endpoint = $1', [endpoint])
      return res.status(200).json({ ok: true })
    },
  },
})

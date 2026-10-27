import { route } from '@/lib/api'

export default route({
  GET: {
    auth: false,
    handle: async (req, res) => {
      const publicKey = process.env.VAPID_PUBLIC_KEY
      if (!publicKey || !process.env.VAPID_PRIVATE_KEY)
        return res.status(503).json({ error: 'الإشعارات غير مفعّلة على الخادم' })
      return res.status(200).json({ publicKey })
    },
  },
})

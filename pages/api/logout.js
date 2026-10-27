import { route } from '@/lib/api'
import { clearSessionCookie } from '@/lib/session'

export default route({
  POST: {
    auth: false,
    handle: async (req, res) => {
      res.setHeader('Set-Cookie', clearSessionCookie())
      return res.status(200).json({ ok: true })
    },
  },
})

import { route } from '@/lib/api'

export default route({
  GET: {
    authError: 'غير مسجل الدخول',
    handle: async (req, res, user) => res.status(200).json({ user }),
  },
})

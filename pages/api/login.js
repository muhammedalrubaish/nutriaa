import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { route, str } from '@/lib/api'
import { signSession, sessionCookie } from '@/lib/session'

// Compared against when the username does not exist, so timing does not reveal valid usernames.
let dummyHash = null
const getDummyHash = () => (dummyHash ||= bcrypt.hashSync('nutri-dummy-password', 10))

export default route({
  POST: {
    auth: false,
    handle: async (req, res) => {
      const username = str(req.body?.username, 100)
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      if (!username || !password) return res.status(400).json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور' })
      const rows = await query(
        'select id, username, name, role, password_hash, created_at from users where username = $1',
        [username],
      )
      const u = rows[0]
      const ok = await bcrypt.compare(password, u?.password_hash || getDummyHash())
      if (!u || !ok) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
      res.setHeader('Set-Cookie', sessionCookie(signSession(u.id)))
      const { password_hash, ...user } = u
      return res.status(200).json({ user })
    },
  },
})

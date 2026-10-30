import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { route, newId, str } from '@/lib/api'
import { PERMS, ROLES, assignableRoles, canManageUser } from '@/lib/roles'

const PW_ERROR = 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'
const RANK_ERROR = 'لا يمكنك تعديل حساب بنفس صلاحيتك أو أعلى منها'
const ROLE_ERROR = 'لا يمكنك منح هذه الصلاحية'

// Rules (enforced here, not only in the UI): you may create, edit or delete only accounts ranked
// strictly below yours and give only roles below yours. On your own account you may change your
// name and password but not your role. So the single system admin can't be created, demoted or
// deleted from the app, and managers can't touch each other.
const mayAssign = (me, role) => assignableRoles(me.role).some((r) => r.id === role)

export default route({
  GET: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res) => {
      const users = await query('select id, username, name, role from users order by created_at, id')
      return res.status(200).json({ users })
    },
  },
  POST: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res, me) => {
      const name = str(req.body?.name, 100)
      const username = str(req.body?.username, 50)
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      const role = req.body?.role
      if (!name || !username || !password) return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول' })
      if (!/^\S{2,50}$/.test(username))
        return res.status(400).json({ error: 'اسم المستخدم يجب ألا يحتوي على مسافات' })
      if (password.length < 6) return res.status(400).json({ error: PW_ERROR })
      if (!ROLES[role]) return res.status(400).json({ error: 'صلاحية غير صالحة' })
      if (!mayAssign(me, role)) return res.status(403).json({ error: ROLE_ERROR })
      const exists = await query('select 1 from users where username = $1', [username])
      if (exists.length) return res.status(409).json({ error: 'اسم المستخدم مستخدم مسبقاً' })
      const hash = await bcrypt.hash(password, 10)
      const rows = await query(
        `insert into users (id, username, name, role, password_hash) values ($1,$2,$3,$4,$5)
         returning id, username, name, role`,
        [newId('u_'), username, name, role, hash],
      )
      return res.status(201).json({ user: rows[0] })
    },
  },
  PUT: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res, me) => {
      const id = String(req.body?.id || '')
      const name = str(req.body?.name, 100)
      const role = req.body?.role
      const password = req.body?.password
      const target = (await query('select id, role from users where id = $1', [id]))[0]
      if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' })
      if (!name) return res.status(400).json({ error: 'الاسم مطلوب' })
      if (!ROLES[role]) return res.status(400).json({ error: 'صلاحية غير صالحة' })
      if (password !== undefined && password !== '' && (typeof password !== 'string' || password.length < 6))
        return res.status(400).json({ error: PW_ERROR })
      if (!canManageUser(me, target)) return res.status(403).json({ error: RANK_ERROR })
      if (target.id === me.id) {
        if (role !== target.role) return res.status(400).json({ error: 'لا يمكنك تغيير صلاحية حسابك' })
      } else if (!mayAssign(me, role)) return res.status(403).json({ error: ROLE_ERROR })
      if (password) {
        const hash = await bcrypt.hash(password, 10)
        await query('update users set name = $2, role = $3, password_hash = $4 where id = $1', [id, name, role, hash])
      } else {
        await query('update users set name = $2, role = $3 where id = $1', [id, name, role])
      }
      return res.status(200).json({ ok: true })
    },
  },
  DELETE: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res, me) => {
      const id = String(req.body?.id || req.query.id || '')
      const target = (await query('select id, role from users where id = $1', [id]))[0]
      if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' })
      if (target.id === me.id) return res.status(400).json({ error: 'لا يمكنك حذف حسابك' })
      if (!canManageUser(me, target)) return res.status(403).json({ error: RANK_ERROR })
      await query('delete from users where id = $1', [id])
      return res.status(200).json({ ok: true })
    },
  },
})

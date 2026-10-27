import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { route, newId, str } from '@/lib/api'
import { PERMS, ROLES } from '@/lib/roles'

const PW_ERROR = 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل'

async function supervisorCount() {
  const rows = await query(`select count(*)::int as n from users where role = 'supervisor'`)
  return rows[0]?.n || 0
}

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
    handle: async (req, res) => {
      const name = str(req.body?.name, 100)
      const username = str(req.body?.username, 50)
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      const role = req.body?.role
      if (!name || !username || !password) return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول' })
      if (!/^\S{2,50}$/.test(username))
        return res.status(400).json({ error: 'اسم المستخدم يجب ألا يحتوي على مسافات' })
      if (password.length < 6) return res.status(400).json({ error: PW_ERROR })
      if (!ROLES[role]) return res.status(400).json({ error: 'صلاحية غير صالحة' })
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
      if (target.role === 'supervisor' && role !== 'supervisor') {
        if (target.id === me.id) return res.status(400).json({ error: 'لا يمكنك إزالة صلاحية المشرف عن حسابك' })
        if ((await supervisorCount()) <= 1) return res.status(400).json({ error: 'يجب أن يبقى مشرف واحد على الأقل' })
      }
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
      if (target.role === 'supervisor' && (await supervisorCount()) <= 1)
        return res.status(400).json({ error: 'يجب أن يبقى مشرف واحد على الأقل' })
      await query('delete from users where id = $1', [id])
      return res.status(200).json({ ok: true })
    },
  },
})

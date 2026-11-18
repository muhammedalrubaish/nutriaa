import { query } from '@/lib/db'
import { route, newId, str } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { sendToAll } from '@/lib/push'
import { audienceUsers, listNotesFor, markNotesRead, validateAudience } from '@/lib/notes'

export default route({
  // ?recipients=1: the people a note can be addressed to (for senders). Otherwise the notes visible to me.
  GET: {
    handle: async (req, res, user) => {
      if (req.query.recipients) {
        if (!['sysadmin', 'manager', 'supervisor'].includes(user.role)) return res.status(403).json({ error: 'لا تملك صلاحية الوصول' })
        const users = await query(`select id, name, role from users where id <> $1 order by name`, [user.id])
        return res.status(200).json({ users })
      }
      return res.status(200).json({ notes: await listNotesFor(user) })
    },
  },
  POST: {
    perm: PERMS.SEND_NOTES,
    handle: async (req, res, user) => {
      const message = str(req.body?.message, 1000)
      if (!message) return res.status(400).json({ error: 'الرجاء كتابة الملاحظة' })
      const aud = validateAudience(req.body || {})
      if (aud.error) return res.status(400).json({ error: aud.error })
      let department = req.body?.department || null
      let deptName = ''
      if (department) {
        const d = (await query('select id, name from departments where id = $1', [String(department)]))[0]
        if (!d) return res.status(400).json({ error: 'القسم غير معروف' })
        department = d.id
        deptName = d.name
      }
      const recipients = await audienceUsers(aud.value, user.id)
      if (aud.value.audience === 'users' && recipients.length !== aud.value.userIds.filter((id) => id !== user.id).length) {
        return res.status(400).json({ error: 'بعض المستلمين غير موجودين' })
      }
      if (!recipients.length) return res.status(400).json({ error: 'لا يوجد مستلمون لهذه الملاحظة' })
      const id = newId('n_')
      const rows = await query(
        `insert into notes (id, message, department, created_by, created_by_name, audience, target_roles)
         values ($1,$2,$3,$4,$5,$6,$7) returning id, message, department, created_by_name, created_at`,
        [id, message, department, user.username, user.name, aud.value.audience, aud.value.roles],
      )
      if (aud.value.audience === 'users') {
        await query(
          `insert into note_recipients (note_id, user_id) select $1, u from unnest($2::text[]) as u on conflict do nothing`,
          [id, recipients.map((u) => u.id)],
        )
      }
      try {
        await sendToAll(
          { title: deptName ? `قسم خدمات التغذية · ${deptName}` : 'قسم خدمات التغذية', body: message, url: '/', tag: 'nutri-note' },
          { userIds: recipients.map((u) => u.id), excludeUserId: user.id },
        )
      } catch (e) {
        console.error('[notes] push failed', e.message)
      }
      const n = rows[0]
      return res.status(201).json({
        note: {
          id: n.id, message: n.message, department: n.department, audience: aud.value.audience, targetRoles: aud.value.roles,
          createdBy: user.username, createdByName: n.created_by_name, createdAt: new Date(n.created_at).toISOString(), mine: true,
          receipts: { total: recipients.length, read: 0, readers: [], pending: recipients.map((u) => u.name) },
        },
      })
    },
  },
  // Mark notes as read: { ids: [...] }.
  PUT: {
    handle: async (req, res, user) => {
      const marked = await markNotesRead(user, req.body?.ids)
      return res.status(200).json({ ok: true, marked })
    },
  },
  // "Delete for everyone": only the note's sender.
  DELETE: {
    perm: PERMS.SEND_NOTES,
    handle: async (req, res, user) => {
      const id = String(req.query.id || req.body?.id || '')
      if (!id) return res.status(400).json({ error: 'المعرّف مطلوب' })
      const n = (await query('select created_by from notes where id = $1', [id]))[0]
      if (!n) return res.status(404).json({ error: 'الملاحظة غير موجودة' })
      if (n.created_by !== user.username) return res.status(403).json({ error: 'يحذف الملاحظة مرسلها فقط' })
      await query('delete from notes where id = $1 and created_by = $2', [id, user.username])
      return res.status(200).json({ ok: true })
    },
  },
})

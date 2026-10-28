import { query } from '@/lib/db'
import { route, newId, str } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { sendToAll } from '@/lib/push'

export default route({
  POST: {
    perm: PERMS.SEND_NOTES,
    handle: async (req, res, user) => {
      const message = str(req.body?.message, 1000)
      if (!message) return res.status(400).json({ error: 'الرجاء كتابة الملاحظة' })
      let department = req.body?.department || null
      let deptName = ''
      if (department) {
        const d = (await query('select id, name from departments where id = $1', [String(department)]))[0]
        if (!d) return res.status(400).json({ error: 'القسم غير معروف' })
        department = d.id
        deptName = d.name
      }
      const rows = await query(
        `insert into notes (id, message, department, created_by, created_by_name)
         values ($1,$2,$3,$4,$5) returning id, message, department, created_by_name, created_at`,
        [newId('n_'), message, department, user.username, user.name],
      )
      try {
        await sendToAll({ title: deptName ? `Nutri · ${deptName}` : 'Nutri', body: message, url: '/', tag: 'nutri-note' })
      } catch (e) {
        console.error('[notes] push failed', e.message)
      }
      const n = rows[0]
      return res.status(201).json({
        note: { id: n.id, message: n.message, department: n.department, createdByName: n.created_by_name, createdAt: new Date(n.created_at).toISOString() },
      })
    },
  },
  DELETE: {
    perm: PERMS.SEND_NOTES,
    handle: async (req, res) => {
      const id = String(req.query.id || req.body?.id || '')
      if (!id) return res.status(400).json({ error: 'المعرّف مطلوب' })
      await query('delete from notes where id = $1', [id])
      return res.status(200).json({ ok: true })
    },
  },
})

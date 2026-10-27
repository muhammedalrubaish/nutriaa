// Department management (new vs production, where the list was hardcoded).
import { query } from '@/lib/db'
import { route, newId } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { listDepartments } from '@/lib/repo'
import { findOverlaps, rowToDept, validateDept } from '@/lib/departments'

async function nameTaken(name, exceptId = null) {
  const rows = await query('select id from departments where lower(name) = lower($1) and id <> coalesce($2, \'\')', [
    name,
    exceptId,
  ])
  return rows.length > 0
}

async function overlapWarnings(dept) {
  const others = await listDepartments()
  const names = findOverlaps(dept, others)
  return names.length ? [`أرقام الغرف تتداخل مع: ${names.join('، ')}`] : []
}

export default route({
  // Any signed-in user may read departments; ?all=1 also returns inactive ones
  // (needed to show names on historical orders and notes).
  GET: {
    handle: async (req, res) => {
      const all = req.query.all === '1' || req.query.all === 'true'
      return res.status(200).json({ departments: await listDepartments({ all }) })
    },
  },
  POST: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res) => {
      const { errors, value } = validateDept(req.body || {})
      if (errors.length) return res.status(400).json({ error: errors[0], errors })
      if (await nameTaken(value.name)) return res.status(409).json({ error: 'يوجد قسم بنفس الاسم' })
      const rows = await query(
        `insert into departments (id, name, color, room_from, room_to, extra_rooms, sort_order, active)
         values ($1,$2,$3,$4,$5,$6::int[], (select coalesce(max(sort_order), 0) + 1 from departments), true)
         returning *`,
        [newId('d_'), value.name, value.color, value.roomFrom, value.roomTo, value.extraRooms],
      )
      const department = rowToDept(rows[0])
      return res.status(201).json({ department, warnings: await overlapWarnings(department) })
    },
  },
  PUT: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res) => {
      const body = req.body || {}
      // Reorder: { order: [id, id, ...] }
      if (Array.isArray(body.order)) {
        const ids = body.order.map(String)
        if (!ids.length || new Set(ids).size !== ids.length) return res.status(400).json({ error: 'ترتيب غير صالح' })
        await query(
          `update departments d set sort_order = o.pos, updated_at = now()
           from unnest($1::text[]) with ordinality as o(id, pos) where d.id = o.id`,
          [ids],
        )
        return res.status(200).json({ ok: true, departments: await listDepartments({ all: true }) })
      }
      const id = String(body.id || '')
      const current = (await query('select * from departments where id = $1', [id]))[0]
      if (!current) return res.status(404).json({ error: 'القسم غير موجود' })
      const merged = { ...rowToDept(current), ...body }
      const { errors, value } = validateDept(merged)
      if (errors.length) return res.status(400).json({ error: errors[0], errors })
      if (await nameTaken(value.name, id)) return res.status(409).json({ error: 'يوجد قسم بنفس الاسم' })
      const rows = await query(
        `update departments set name = $2, color = $3, room_from = $4, room_to = $5,
           extra_rooms = $6::int[], active = $7, updated_at = now()
         where id = $1 returning *`,
        [id, value.name, value.color, value.roomFrom, value.roomTo, value.extraRooms, value.active],
      )
      const department = rowToDept(rows[0])
      return res.status(200).json({ department, warnings: department.active ? await overlapWarnings(department) : [] })
    },
  },
  // Hard-deletes only when no order references the department; otherwise deactivates it.
  DELETE: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res) => {
      const id = String(req.query.id || req.body?.id || '')
      const current = (await query('select id from departments where id = $1', [id]))[0]
      if (!current) return res.status(404).json({ error: 'القسم غير موجود' })
      const used = await query('select 1 from orders where department = $1 limit 1', [id])
      if (used.length) {
        await query('update departments set active = false, updated_at = now() where id = $1', [id])
        return res.status(200).json({ ok: true, deactivated: true })
      }
      await query('delete from departments where id = $1', [id])
      return res.status(200).json({ ok: true, deleted: true })
    },
  },
})

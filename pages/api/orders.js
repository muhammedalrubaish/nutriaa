import { query } from '@/lib/db'
import { route } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { isYmd } from '@/lib/time'
import { deptMap, insertOrder, rowToOrder, validateOrder } from '@/lib/repo'

export default route({
  GET: {
    perm: PERMS.VIEW_REPORTS,
    handle: async (req, res) => {
      const where = []
      const params = []
      const { department, date } = req.query
      if (department) {
        params.push(String(department))
        where.push(`department = $${params.length}`)
      }
      if (date) {
        if (!isYmd(String(date))) return res.status(400).json({ error: 'تاريخ غير صالح' })
        params.push(String(date))
        // Day boundaries in Asia/Riyadh.
        where.push(`created_at >= ($${params.length}::timestamp at time zone 'Asia/Riyadh')`)
        where.push(`created_at < (($${params.length}::date + 1)::timestamp at time zone 'Asia/Riyadh')`)
      }
      const rows = await query(
        `select * from orders ${where.length ? 'where ' + where.join(' and ') : ''}
         order by created_at desc limit 5000`,
        params,
      )
      return res.status(200).json({ orders: rows.map(rowToOrder) })
    },
  },
  POST: {
    perm: PERMS.CREATE_ORDERS,
    handle: async (req, res, user) => {
      const { error, value } = validateOrder(req.body || {}, await deptMap())
      if (error) return res.status(400).json({ error })
      const order = await insertOrder(value, user)
      return res.status(201).json({ order })
    },
  },
  DELETE: {
    perm: PERMS.DELETE_ORDERS,
    handle: async (req, res) => {
      const id = String(req.query.id || req.body?.id || '')
      if (!id) return res.status(400).json({ error: 'المعرّف مطلوب' })
      await query('delete from orders where id = $1', [id])
      return res.status(200).json({ ok: true })
    },
  },
})

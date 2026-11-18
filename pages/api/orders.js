import { query } from '@/lib/db'
import { route } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { isYmd } from '@/lib/time'
import { DuplicateOrderError, deptMap, duplicateMessage, insertOrder, noMainMealError, notifyNewOrders, readMenu, rowToOrder, validateOrder } from '@/lib/repo'

export default route({
  GET: {
    perm: PERMS.VIEW_REPORTS,
    handle: async (req, res) => {
      const where = []
      const params = []
      const { department, date, user } = req.query
      // `date` is a single day; `from`/`to` an inclusive range. Day boundaries in Asia/Riyadh.
      // by=meal (the log, its cards and Excel): filter on the MEAL date (orders.meal_date, migration 005);
      // default: the entry date (created_at), which the dashboard statistics use.
      const byMeal = req.query.by === 'meal'
      const mealDay = `coalesce(meal_date, (created_at at time zone 'Asia/Riyadh')::date)`
      const from = String(req.query.from || date || '')
      const to = String(req.query.to || date || '')
      if (department) {
        params.push(String(department))
        where.push(`department = $${params.length}`)
      }
      if (user) {
        params.push(String(user))
        where.push(`created_by = $${params.length}`)
      }
      if (from) {
        if (!isYmd(from)) return res.status(400).json({ error: 'تاريخ غير صالح' })
        params.push(from)
        where.push(byMeal ? `${mealDay} >= $${params.length}::date` : `created_at >= ($${params.length}::timestamp at time zone 'Asia/Riyadh')`)
      }
      if (to) {
        if (!isYmd(to)) return res.status(400).json({ error: 'تاريخ غير صالح' })
        params.push(to)
        where.push(byMeal ? `${mealDay} <= $${params.length}::date` : `created_at < (($${params.length}::date + 1)::timestamp at time zone 'Asia/Riyadh')`)
      }
      const rows = await query(
        `select * from orders ${where.length ? 'where ' + where.join(' and ') : ''}
         order by ${byMeal ? `${mealDay} desc, ` : ''}created_at desc limit 5000`,
        params,
      )
      return res.status(200).json({ orders: rows.map(rowToOrder) })
    },
  },
  POST: {
    perm: PERMS.CREATE_ORDERS,
    handle: async (req, res, user) => {
      const depts = await deptMap()
      const { error, value } = validateOrder(req.body || {}, depts)
      if (error) return res.status(400).json({ error })
      const noMain = noMainMealError(await readMenu(), value.day)
      if (noMain) return res.status(400).json({ error: noMain })
      let order
      try {
        order = await insertOrder(value, user)
      } catch (e) {
        if (!(e instanceof DuplicateOrderError)) throw e
        return res.status(409).json({ error: duplicateMessage(e.existing), duplicate: e.existing })
      }
      // A replayed submit key is the same order, already announced.
      if (order.replay) return res.status(200).json({ order })
      await notifyNewOrders(user, { order, deptName: depts[order.department]?.name })
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

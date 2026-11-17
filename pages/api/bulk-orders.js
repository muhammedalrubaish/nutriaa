import { route } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { DuplicateOrderError, deptMap, duplicateMessage, insertOrder, noMainMealError, notifyNewOrders, readMenu, validateOrder } from '@/lib/repo'

export default route({
  POST: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res, user) => {
      const list = Array.isArray(req.body?.orders) ? req.body.orders : null
      if (!list) return res.status(400).json({ error: 'لا توجد طلبات للاستيراد' })
      if (list.length > 1000) return res.status(400).json({ error: 'الحد الأقصى 1000 طلب في المرة الواحدة' })
      const [depts, menu] = await Promise.all([deptMap(), readMenu()])
      let imported = 0
      const errors = []
      let duplicates = 0
      for (let i = 0; i < list.length; i++) {
        // `row` is the real Excel row number sent by the import page; errors quote it as-is.
        const row = Number.isInteger(list[i]?.row) ? list[i].row : undefined
        const { error, value } = validateOrder({ mealType: 'main', ...list[i], id: undefined }, depts)
        if (error) {
          errors.push({ index: i, row, error })
          continue
        }
        // QA: same rule as the entry screen — no orders for a day without a main meal (e.g. Friday).
        const noMain = noMainMealError(menu, value.day)
        if (noMain) {
          errors.push({ index: i, row, error: noMain, noMain: true })
          continue
        }
        try {
          await insertOrder(value, user)
          imported++
        } catch (e) {
          if (e instanceof DuplicateOrderError) {
            duplicates++
            errors.push({ index: i, row, error: duplicateMessage(e.existing), duplicate: true })
            continue
          }
          console.error('[bulk-orders] row', i, e.message)
          errors.push({ index: i, row, error: 'تعذّر الحفظ' })
        }
      }
      // One push for the whole import, not one per row.
      if (imported) await notifyNewOrders(user, { imported })
      return res.status(200).json({ imported, failed: errors.length, duplicates, errors })
    },
  },
})

import { route } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { deptMap, insertOrder, validateOrder } from '@/lib/repo'

export default route({
  POST: {
    perm: PERMS.MANAGE_USERS,
    handle: async (req, res, user) => {
      const list = Array.isArray(req.body?.orders) ? req.body.orders : null
      if (!list) return res.status(400).json({ error: 'لا توجد طلبات للاستيراد' })
      if (list.length > 1000) return res.status(400).json({ error: 'الحد الأقصى 1000 طلب في المرة الواحدة' })
      const depts = await deptMap()
      let imported = 0
      const errors = []
      for (let i = 0; i < list.length; i++) {
        const { error, value } = validateOrder({ mealType: 'main', ...list[i] }, depts)
        if (error) {
          errors.push({ index: i, error })
          continue
        }
        try {
          await insertOrder(value, user)
          imported++
        } catch (e) {
          console.error('[bulk-orders] row', i, e.message)
          errors.push({ index: i, error: 'تعذّر الحفظ' })
        }
      }
      return res.status(200).json({ imported, failed: errors.length, errors })
    },
  },
})

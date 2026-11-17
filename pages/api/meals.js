// Note 8: the meal library behind the searchable pickers on the menu page.
import { query } from '@/lib/db'
import { route, str } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { addToMealLibrary } from '@/lib/repo'

const CATEGORIES = ['main', 'optional', 'any']

export default route({
  GET: {
    perm: PERMS.CREATE_ORDERS,
    handle: async (req, res) => {
      const rows = await query(`select id, name, category from meal_library where active order by name`)
      return res.status(200).json({ meals: rows })
    },
  },
  POST: {
    perm: PERMS.EDIT_MENU,
    handle: async (req, res) => {
      const name = str(req.body?.name, 200)
      if (!name) return res.status(400).json({ error: 'اكتب اسم الوجبة' })
      const category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'any'
      await addToMealLibrary([name], category)
      // A name removed earlier comes back when added again.
      await query(`update meal_library set active = true where lower(btrim(name)) = lower(btrim($1))`, [name])
      return res.status(201).json({ ok: true })
    },
  },
  DELETE: {
    perm: PERMS.EDIT_MENU,
    handle: async (req, res) => {
      const id = String(req.query.id || '')
      if (!id) return res.status(400).json({ error: 'المعرّف مطلوب' })
      await query('update meal_library set active = false where id = $1', [id])
      return res.status(200).json({ ok: true })
    },
  },
})

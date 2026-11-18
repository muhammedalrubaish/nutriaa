import { query } from '@/lib/db'
import { route, str } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { WEEK_DAYS } from '@/lib/constants'
import { optionalsWithoutMain } from '@/lib/menuImport'
import { OPTIONAL_KEYS, addToMealLibrary, diffMenu, notifyMenuChange, readMenu } from '@/lib/repo'

export default route({
  GET: {
    handle: async (req, res) => res.status(200).json({ menu: await readMenu() }),
  },
  PUT: {
    perm: PERMS.EDIT_MENU,
    handle: async (req, res, user) => {
      const menu = req.body?.menu
      if (!menu || typeof menu !== 'object') return res.status(400).json({ error: 'بيانات القائمة غير صالحة' })
      const before = await readMenu()
      const names = { main: [], optional: [] }
      for (const d of WEEK_DAYS) {
        const m = menu[d.id]
        if (!m) continue
        const main = str(m.mainMeal, 200)
        const opts = OPTIONAL_KEYS.map((k) => str(m[k], 200))
        // An optional item can only be set together with a main meal for the same day.
        if (optionalsWithoutMain({ mainMeal: main, optionalItem: opts[0], optionalItem2: opts[1], optionalItem3: opts[2] })) {
          return res.status(400).json({ error: `يوم ${d.name}: لا يمكن حفظ وجبات اختيارية بدون وجبة أساسية` })
        }
        names.main.push(main)
        names.optional.push(...opts)
        await query(
          `insert into menu (day, main_meal, optional_item, optional_item_2, optional_item_3, updated_at)
           values ($1, $2, $3, $4, $5, now())
           on conflict (day) do update set main_meal = excluded.main_meal, optional_item = excluded.optional_item,
             optional_item_2 = excluded.optional_item_2, optional_item_3 = excluded.optional_item_3, updated_at = now()`,
          [d.id, main, ...opts],
        )
      }
      await addToMealLibrary(names.main, 'main')
      await addToMealLibrary(names.optional, 'optional')
      const after = await readMenu()
      // Only real edits raise an alert; saving an unchanged menu stays silent.
      const changed = diffMenu(before, after)
      await notifyMenuChange(user, changed)
      return res.status(200).json({ ok: true, menu: after, changed: changed.map((c) => c.day) })
    },
  },
})

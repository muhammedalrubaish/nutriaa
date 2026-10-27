import { query } from '@/lib/db'
import { route, str } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { WEEK_DAYS } from '@/lib/constants'

async function readMenu() {
  const rows = await query('select day, main_meal, optional_item from menu')
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]))
  return Object.fromEntries(
    WEEK_DAYS.map((d) => [d.id, { mainMeal: byDay[d.id]?.main_meal || '', optionalItem: byDay[d.id]?.optional_item || '' }]),
  )
}

export default route({
  GET: {
    handle: async (req, res) => res.status(200).json({ menu: await readMenu() }),
  },
  PUT: {
    perm: PERMS.EDIT_MENU,
    handle: async (req, res) => {
      const menu = req.body?.menu
      if (!menu || typeof menu !== 'object') return res.status(400).json({ error: 'بيانات القائمة غير صالحة' })
      for (const d of WEEK_DAYS) {
        if (!menu[d.id]) continue
        await query(
          `insert into menu (day, main_meal, optional_item, updated_at) values ($1, $2, $3, now())
           on conflict (day) do update set main_meal = excluded.main_meal,
             optional_item = excluded.optional_item, updated_at = now()`,
          [d.id, str(menu[d.id].mainMeal, 200), str(menu[d.id].optionalItem, 200)],
        )
      }
      return res.status(200).json({ ok: true, menu: await readMenu() })
    },
  },
})

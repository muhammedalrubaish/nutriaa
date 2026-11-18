// Note 10 (live updates): a tiny fingerprint of the data every screen shows. Clients poll it every few
// seconds while visible (lib/useLive.js) and reload only when it changes, so a new order, note or
// menu edit shows up on every open screen within seconds without a full refresh.
import { query } from '@/lib/db'
import { route } from '@/lib/api'

export default route({
  GET: {
    handle: async (req, res) => {
      const rows = await query(
        `select md5(concat_ws('|',
           (select count(*) from orders), (select max(created_at) from orders),
           (select count(*) from notes), (select max(created_at) from notes),
           (select count(*) from note_reads),
           (select max(updated_at) from menu),
           (select md5(value::text) from settings where key = 'menu_changes'),
           (select max(updated_at) from departments)
         )) as v`,
      )
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ v: rows[0]?.v || '' })
    },
  },
})

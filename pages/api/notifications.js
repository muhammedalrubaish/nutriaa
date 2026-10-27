import { query } from '@/lib/db'
import { route } from '@/lib/api'
import { listDepartments, getMinDaily, todayCountsByDepartment } from '@/lib/repo'
import { riyadhDate } from '@/lib/time'

export default route({
  GET: {
    handle: async (req, res) => {
      const [departments, minDaily, counts, notes] = await Promise.all([
        listDepartments(),
        getMinDaily(),
        todayCountsByDepartment(riyadhDate()),
        query(
          `select id, message, department, created_by, created_by_name, created_at
           from notes order by created_at desc limit 50`,
        ),
      ])
      const alerts = departments
        .map((d) => ({ department: d.id, name: d.name, total: counts[d.id] || 0, min: minDaily }))
        .filter((a) => a.total < minDaily)
      return res.status(200).json({
        alerts,
        notes: notes.map((n) => ({
          id: n.id,
          message: n.message,
          department: n.department,
          createdBy: n.created_by,
          createdByName: n.created_by_name,
          createdAt: new Date(n.created_at).toISOString(),
        })),
        minDaily,
      })
    },
  },
})

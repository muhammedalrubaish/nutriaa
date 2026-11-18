import { query } from '@/lib/db'
import { route } from '@/lib/api'
import { can, PERMS } from '@/lib/roles'
import { listDepartments, getMinDaily, recentMenuChanges, rowToOrder, todayCountsByDepartment } from '@/lib/repo'
import { riyadhDate } from '@/lib/time'
import { listNotesFor } from '@/lib/notes'

// How many of today's newest orders are surfaced in the bell.
const ORDER_LIMIT = 30

export default route({
  GET: {
    handle: async (req, res, user) => {
      const today = riyadhDate()
      // Order notifications go to whoever reviews orders, not to the staff entering them.
      const withOrders = can(user.role, PERMS.VIEW_REPORTS)
      const [departments, minDaily, counts, notes, orders, menuChanges] = await Promise.all([
        listDepartments(),
        getMinDaily(),
        todayCountsByDepartment(today),
        // Only notes addressed to me (or sent by me), with my read state.
        listNotesFor(user),
        withOrders
          ? query(
              `select * from orders
               where created_at >= ($1::timestamp at time zone 'Asia/Riyadh')
               order by created_at desc limit ${ORDER_LIMIT}`,
              [today],
            )
          : [],
        recentMenuChanges(),
      ])
      const deptName = Object.fromEntries(departments.map((d) => [d.id, d.name]))
      const alerts = departments
        .map((d) => ({ department: d.id, name: d.name, total: counts[d.id] || 0, min: minDaily }))
        .filter((a) => a.total < minDaily)
      return res.status(200).json({
        alerts,
        // The bell lists notes for me; my own sent notes (with read receipts) live on the dashboard.
        notes: notes.filter((n) => !n.mine && !n.readAt),
        sentNotes: notes.filter((n) => n.mine),
        orders: orders.map((r) => {
          const o = rowToOrder(r)
          return {
            id: o.id,
            department: o.department,
            departmentName: deptName[o.department] || o.department,
            room: o.room,
            bed: o.bed,
            personType: o.personType,
            mealTime: o.mealTime,
            mainMeal: o.mainMeal,
            createdByName: o.createdByName,
            createdAt: o.createdAt,
          }
        }),
        // The editor already knows what they changed.
        menuChanges: menuChanges.filter((m) => m.createdBy !== user.username),
        minDaily,
      })
    },
  },
})

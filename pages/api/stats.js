import { query } from '@/lib/db'
import { route } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { listDepartments, getMinDaily } from '@/lib/repo'
import { riyadhDate, addDays, weekStart, monthStart } from '@/lib/time'

export default route({
  GET: {
    perm: PERMS.VIEW_REPORTS,
    handle: async (req, res) => {
      const today = riyadhDate()
      const trendFrom = addDays(today, -6)
      const week = weekStart(today)
      const month = monthStart(today)
      const from = [trendFrom, week, month].sort()[0]

      const [rows, totalRows, departments, minDaily] = await Promise.all([
        query(
          `select department, person_type, meal_time,
                  to_char((created_at at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD') as d,
                  count(*)::int as n
           from orders
           where created_at >= ($1::timestamp at time zone 'Asia/Riyadh')
           group by 1, 2, 3, 4`,
          [from],
        ),
        query('select count(*)::int as n from orders'),
        listDepartments(),
        getMinDaily(),
      ])

      const indicators = { daily: 0, weekly: 0, monthly: 0, total: totalRows[0]?.n || 0 }
      const byPersonType = { patient: 0, companion: 0 }
      const byMealTime = { breakfast: 0, lunch: 0, dinner: 0 }
      const perDept = {}
      const perDay = {}
      for (const r of rows) {
        if (r.d === today) indicators.daily += r.n
        if (r.d >= week) indicators.weekly += r.n
        if (r.d >= month) indicators.monthly += r.n
        perDay[r.d] = (perDay[r.d] || 0) + r.n
        if (r.d !== today) continue
        byPersonType[r.person_type] = (byPersonType[r.person_type] || 0) + r.n
        byMealTime[r.meal_time] = (byMealTime[r.meal_time] || 0) + r.n
        const p = (perDept[r.department] ||= { total: 0, patient: 0, companion: 0 })
        p.total += r.n
        p[r.person_type] += r.n
      }

      const byDepartment = departments.map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color,
        total: perDept[d.id]?.total || 0,
        patient: perDept[d.id]?.patient || 0,
        companion: perDept[d.id]?.companion || 0,
      }))
      const trend = []
      for (let i = 6; i >= 0; i--) {
        const date = addDays(today, -i)
        trend.push({ date, count: perDay[date] || 0 })
      }
      const lowAlerts = byDepartment
        .filter((d) => d.total < minDaily)
        .map((d) => ({ department: d.id, name: d.name, total: d.total }))

      return res.status(200).json({ today, minDaily, indicators, byDepartment, byPersonType, byMealTime, trend, lowAlerts })
    },
  },
})

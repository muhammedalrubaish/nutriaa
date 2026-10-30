import { query } from '@/lib/db'
import { route } from '@/lib/api'
import { PERMS } from '@/lib/roles'
import { listDepartments, getMinDaily, todayCountsByDepartment } from '@/lib/repo'
import { riyadhDate, addDays, isYmd, daysBetween, weekStart } from '@/lib/time'

const MAX_RANGE_DAYS = 732

/** Trend granularity for a range of `days` days. */
function trendUnit(days) {
  return days <= 1 ? 'hour' : days <= 31 ? 'day' : days <= 180 ? 'week' : 'month'
}

function trendKeys(unit, from, to) {
  if (unit === 'hour') return Array.from({ length: 24 }, (_, h) => String(h))
  const keys = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = unit === 'day' ? d : unit === 'week' ? weekStart(d) : d.slice(0, 7)
    if (keys[keys.length - 1] !== k) keys.push(k)
  }
  return keys
}

export default route({
  GET: {
    perm: PERMS.VIEW_REPORTS,
    handle: async (req, res) => {
      const today = riyadhDate()
      const from = req.query.from ? String(req.query.from) : today
      const to = req.query.to ? String(req.query.to) : from
      const createdBy = req.query.user ? String(req.query.user) : ''
      if (!isYmd(from) || !isYmd(to)) return res.status(400).json({ error: 'تاريخ غير صالح' })
      if (from > to) return res.status(400).json({ error: 'تاريخ البداية بعد تاريخ النهاية' })
      const days = daysBetween(from, to) + 1
      if (days > MAX_RANGE_DAYS) return res.status(400).json({ error: 'الفترة طويلة جداً (الحد الأقصى سنتان)' })
      const unit = trendUnit(days)

      const params = [from, to]
      if (createdBy) params.push(createdBy)
      const [rows, departments, minDaily, todayCounts, users] = await Promise.all([
        query(
          `select department, person_type, meal_time, created_by,
                  to_char((created_at at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD') as d,
                  count(*)::int as n,
                  max(created_by_name) as created_by_name
                  ${unit === 'hour' ? `, extract(hour from created_at at time zone 'Asia/Riyadh')::int as h` : ''}
           from orders
           where created_at >= ($1::timestamp at time zone 'Asia/Riyadh')
             and created_at < (($2::date + 1)::timestamp at time zone 'Asia/Riyadh')
             ${createdBy ? 'and created_by = $3' : ''}
           group by 1, 2, 3, 4, 5${unit === 'hour' ? ', 8' : ''}`,
          params,
        ),
        listDepartments(),
        getMinDaily(),
        // Shortfall alerts are always about today and all staff, whatever the filter.
        todayCountsByDepartment(today),
        query('select username, name from users order by name, username'),
      ])

      const summary = { total: 0, patient: 0, companion: 0 }
      const byMealTime = { breakfast: 0, lunch: 0, dinner: 0 }
      const perDept = {}
      const perUser = {}
      const perBucket = {}
      for (const r of rows) {
        summary.total += r.n
        summary[r.person_type] = (summary[r.person_type] || 0) + r.n
        byMealTime[r.meal_time] = (byMealTime[r.meal_time] || 0) + r.n
        const p = (perDept[r.department] ||= { total: 0, patient: 0, companion: 0 })
        p.total += r.n
        p[r.person_type] += r.n
        const u = (perUser[r.created_by] ||= { username: r.created_by, name: r.created_by_name, total: 0 })
        u.total += r.n
        const k = unit === 'hour' ? String(r.h) : unit === 'day' ? r.d : unit === 'week' ? weekStart(r.d) : r.d.slice(0, 7)
        perBucket[k] = (perBucket[k] || 0) + r.n
      }
      summary.avgDaily = Math.round((summary.total / days) * 10) / 10

      const byDepartment = departments.map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color,
        total: perDept[d.id]?.total || 0,
        patient: perDept[d.id]?.patient || 0,
        companion: perDept[d.id]?.companion || 0,
      }))
      const byUser = Object.values(perUser).sort((a, b) => b.total - a.total)
      const trend = { unit, points: trendKeys(unit, from, to).map((key) => ({ key, count: perBucket[key] || 0 })) }
      const lowAlerts = departments
        .map((d) => ({ department: d.id, name: d.name, total: todayCounts[d.id] || 0 }))
        .filter((d) => d.total < minDaily)

      return res.status(200).json({
        today, from, to, days, user: createdBy || null, minDaily,
        summary, byDepartment, byPersonType: { patient: summary.patient, companion: summary.companion }, byMealTime,
        byUser, trend, lowAlerts, users,
      })
    },
  },
})

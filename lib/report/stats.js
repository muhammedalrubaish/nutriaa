// Client-side statistics for the printed/PDF reports, computed from the orders of the chosen period/filters.
import { DAYS, MEAL_TIMES, MEAL_TYPE_NAME, hourOf } from './common';
import { addDays, riyadhDate, weekStart } from '../time';
/** Days in an inclusive range (either order). */
const daysBetween = (from, to) => {
    const [a, b] = from <= to ? [from, to] : [to, from];
    return Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
};
export const mealKey = (s) => s.replace(/\s+/g, ' ').trim();
/** Custom (free-text) meals are temporary, per patient wish, so they never enter per-meal rankings or comparisons
 * (Abdullah 19 Nov «لاتضيف الوجبات المخصصه لهذه الاحصائيات»). Totals and the «مخصصة» counts still include them. */
export const isCustomOrder = (o) => (o?.mealType ?? o?.meal_type) === 'custom';
/** Note 5/12: meals ranked by how many times they were chosen (custom meals left out; shares over the rest). */
export function rankMeals(orders, menu) {
    const map = new Map();
    const get = (name) => {
        const k = mealKey(name);
        let r = map.get(k);
        if (!r) {
            r = { name: k, total: 0, patient: 0, companion: 0, main: 0, optional: 0, custom: 0, pct: 0, inMenu: false };
            map.set(k, r);
        }
        return r;
    };
    if (menu)
        for (const d of Object.values(menu))
            for (const n of [d.mainMeal, d.optionalItem, d.optionalItem2, d.optionalItem3])
                if (mealKey(n || ''))
                    get(n).inMenu = true;
    const ranked = orders.filter(o => !isCustomOrder(o));
    for (const o of ranked) {
        const r = get(o.mainMeal || '—');
        r.total++;
        r[o.personType === 'companion' ? 'companion' : 'patient']++;
        r[o.mealType]++;
    }
    const total = ranked.length || 1;
    return [...map.values()]
        .filter(r => r.total > 0 || r.inMenu)
        .map(r => ({ ...r, pct: Math.round((r.total / total) * 1000) / 10 }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'));
}
export function topBottom(ranks, n = 3) {
    const menuOnes = ranks.filter(r => r.inMenu || r.main + r.optional > 0);
    const pool = menuOnes.length >= 2 ? menuOnes : ranks;
    const top = pool.filter(r => r.total > 0).slice(0, n);
    const bottom = [...pool].sort((a, b) => a.total - b.total || a.name.localeCompare(b.name, 'ar')).filter(r => !top.includes(r)).slice(0, n);
    return { top, bottom };
}
export function computeStats(orders, o) {
    const days = daysBetween(o.from, o.to);
    const s = { total: orders.length, patient: 0, companion: 0, avgDaily: 0, main: 0, optional: 0, custom: 0 };
    for (const x of orders) {
        s[x.personType === 'companion' ? 'companion' : 'patient']++;
        s[x.mealType]++;
    }
    s.avgDaily = Math.round((orders.length / days) * 10) / 10;
    // trend
    const unit = days === 1 ? 'hour' : days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
    const buckets = new Map();
    const keyOf = (iso) => {
        const d = riyadhDate(new Date(iso));
        return unit === 'hour' ? String(hourOf(iso)).padStart(2, '0') : unit === 'day' ? d : unit === 'week' ? weekStart(d) : d.slice(0, 7);
    };
    if (unit === 'hour')
        for (let h = 6; h <= 22; h++)
            buckets.set(String(h).padStart(2, '0'), { label: `${h}:00`, count: 0, patient: 0, companion: 0 });
    else if (unit === 'day')
        for (let i = 0; i < days; i++) {
            const d = addDays(o.from <= o.to ? o.from : o.to, i);
            buckets.set(d, { label: d.slice(5), count: 0, patient: 0, companion: 0 });
        }
    for (const x of orders) {
        const k = keyOf(x.createdAt);
        let b = buckets.get(k);
        if (!b) {
            b = { label: unit === 'hour' ? `${Number(k)}:00` : unit === 'week' ? k.slice(5) : k, count: 0, patient: 0, companion: 0 };
            buckets.set(k, b);
        }
        b.count++;
        b[x.personType === 'companion' ? 'companion' : 'patient']++;
    }
    const points = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
    const deptMap = new Map(o.departments.map(d => [d.id, { id: d.id, name: d.name, color: d.color, total: 0, patient: 0, companion: 0 }]));
    for (const x of orders) {
        let d = deptMap.get(x.department);
        if (!d) {
            d = { id: x.department, name: x.department, color: 'sky', total: 0, patient: 0, companion: 0 };
            deptMap.set(x.department, d);
        }
        d.total++;
        d[x.personType === 'companion' ? 'companion' : 'patient']++;
    }
    const activeIds = new Set(o.departments.filter(d => d.active !== false).map(d => d.id));
    const byDepartment = [...deptMap.values()].filter(d => d.total > 0 || activeIds.has(d.id)).sort((a, b) => b.total - a.total);
    const byMealTime = MEAL_TIMES.map(m => ({ id: m.id, name: m.name, count: orders.filter(x => x.mealTime === m.id).length }));
    const byMealType = Object.keys(MEAL_TYPE_NAME).map(id => ({ id, name: MEAL_TYPE_NAME[id], count: s[id] }));
    const byWeekday = DAYS.map(d => ({ id: d.id, name: d.name, count: orders.filter(x => x.day === d.id).length }));
    const byUser = usersRank(orders, o.users);
    return { from: o.from, to: o.to, days, minDaily: o.minDaily, summary: s, trend: { unit, points }, byDepartment, byMealTime, byMealType, byWeekday, byUser, meals: rankMeals(orders, o.menu) };
}
export function usersRank(orders, users, roles) {
    // orders.created_by holds the author's username in this app.
    const um = new Map(users.map(u => [u.username, u]));
    const m = new Map();
    for (const x of orders) {
        const u = um.get(x.createdBy);
        let r = m.get(x.createdBy);
        if (!r) {
            r = { id: x.createdBy, name: u?.name ?? x.createdByName, role: u?.role ?? '', total: 0 };
            m.set(x.createdBy, r);
        }
        r.total++;
    }
    let out = [...m.values()];
    if (roles) {
        const seen = new Set(out.map(r => r.id));
        for (const u of users)
            if (roles.includes(u.role) && !seen.has(u.username))
                out.push({ id: u.username, name: u.name, role: u.role, total: 0 });
        out = out.filter(r => roles.includes(r.role));
    }
    return out.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'));
}
/** Departments below the expected daily minimum today (bell alerts). */
export function lowDepartments(todayOrders, departments, minDaily) {
    return departments.filter(d => d.active !== false).map(d => ({ department: d.id, name: d.name, total: todayOrders.filter(o => o.department === d.id).length, min: minDaily }))
        .filter(x => x.total < minDaily);
}

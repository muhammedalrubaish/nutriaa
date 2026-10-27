function plural(n, one, two, many) {
  return n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? many : one
}

export function timeAgo(iso) {
  const t = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return 'الآن'
  const m = Math.floor(s / 60)
  if (m < 60) return `منذ ${m} ${plural(m, 'دقيقة', 'دقيقتين', 'دقائق')}`
  const h = Math.floor(m / 60)
  if (h < 24) return `منذ ${h} ${plural(h, 'ساعة', 'ساعتين', 'ساعات')}`
  const d = Math.floor(h / 24)
  if (d < 30) return `منذ ${d} ${plural(d, 'يوم', 'يومين', 'أيام')}`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `منذ ${mo} ${plural(mo, 'شهر', 'شهرين', 'أشهر')}`
  const y = Math.floor(mo / 12)
  return `منذ ${y} ${plural(y, 'سنة', 'سنتين', 'سنوات')}`
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export const PERMS = {
  CREATE_ORDERS: 'create_orders',
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',
  DELETE_ORDERS: 'delete_orders',
  MANAGE_USERS: 'manage_users',
  EDIT_MENU: 'edit_menu',
  SEND_NOTES: 'send_notes',
}

export const ROLES = {
  supervisor: { id: 'supervisor', name: 'مشرف', desc: 'جميع الصلاحيات', perms: Object.values(PERMS) },
  distributor: { id: 'distributor', name: 'موظفة موزّعة', desc: 'إدخال الطلبات فقط', perms: [PERMS.CREATE_ORDERS] },
  specialist: {
    id: 'specialist',
    name: 'أخصائية',
    desc: 'تصدير التقارير فقط',
    perms: [PERMS.VIEW_REPORTS, PERMS.EXPORT_REPORTS],
  },
}

export const ROLE_LIST = Object.values(ROLES).map((r) => ({ id: r.id, name: r.name, desc: r.desc }))

export function roleName(id) {
  return ROLES[id]?.name || id
}

export function can(role, perm) {
  return !!ROLES[role]?.perms.includes(perm)
}

export function homeFor(role) {
  return can(role, PERMS.VIEW_REPORTS) ? '/' : can(role, PERMS.CREATE_ORDERS) ? '/orders' : '/login'
}

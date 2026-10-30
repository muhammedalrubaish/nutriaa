export const PERMS = {
  CREATE_ORDERS: 'create_orders',
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',
  DELETE_ORDERS: 'delete_orders',
  MANAGE_USERS: 'manage_users',
  EDIT_MENU: 'edit_menu',
  SEND_NOTES: 'send_notes',
}

// Ranked from the top. Everyone can manage only accounts ranked strictly below them, so there is
// exactly one system admin (nobody can create, edit or delete one from the app) and a manager cannot
// touch other managers. Specialist and distributor share the lowest rank.
export const ROLES = {
  sysadmin: {
    id: 'sysadmin',
    name: 'مدير النظام',
    desc: 'جميع الصلاحيات وإدارة المدراء (حساب واحد)',
    rank: 4,
    perms: Object.values(PERMS),
  },
  manager: { id: 'manager', name: 'مدير', desc: 'جميع الصلاحيات عدا إدارة المدراء', rank: 3, perms: Object.values(PERMS) },
  supervisor: {
    id: 'supervisor',
    name: 'مشرف',
    desc: 'الطلبات والتقارير والقائمة والملاحظات',
    rank: 2,
    perms: [PERMS.CREATE_ORDERS, PERMS.VIEW_REPORTS, PERMS.EXPORT_REPORTS, PERMS.DELETE_ORDERS, PERMS.EDIT_MENU, PERMS.SEND_NOTES],
  },
  specialist: {
    id: 'specialist',
    name: 'أخصائية',
    desc: 'التقارير وتصديرها فقط',
    rank: 1,
    perms: [PERMS.VIEW_REPORTS, PERMS.EXPORT_REPORTS],
  },
  distributor: { id: 'distributor', name: 'موظفة موزّعة', desc: 'إدخال الطلبات فقط', rank: 1, perms: [PERMS.CREATE_ORDERS] },
}

export const ROLE_LIST = Object.values(ROLES).map((r) => ({ id: r.id, name: r.name, desc: r.desc }))

export function roleName(id) {
  return ROLES[id]?.name || id
}

export function rankOf(role) {
  return ROLES[role]?.rank || 0
}

/** Roles `actorRole` may give to other accounts: strictly below its own rank. */
export function assignableRoles(actorRole) {
  return ROLE_LIST.filter((r) => rankOf(r.id) < rankOf(actorRole))
}

/** Whether `actor` may edit or delete `target` (own account: name and password only, never role). */
export function canManageUser(actor, target) {
  return !!actor && !!target && (actor.id === target.id || rankOf(target.role) < rankOf(actor.role))
}

export function rolesWith(perm) {
  return Object.values(ROLES).filter((r) => r.perms.includes(perm)).map((r) => r.id)
}

export function can(role, perm) {
  return !!ROLES[role]?.perms.includes(perm)
}

export function homeFor(role) {
  return can(role, PERMS.VIEW_REPORTS) ? '/' : can(role, PERMS.CREATE_ORDERS) ? '/orders' : '/login'
}

// Note 11: dashboard notes with a chosen audience (everyone / roles / people) and read receipts.
// A note is visible to its sender and its audience only. notes.created_by is the sender's username
// (as for orders); recipients and readers are stored by user id.
import { query } from './db'
import { ROLES } from './roles'

export const AUDIENCES = ['all', 'role', 'users']

/** SQL condition: note `n` is visible to the user in params $1 (username), $2 (role), $3 (id). */
const VISIBLE = `(n.created_by = $1
  or n.audience = 'all'
  or (n.audience = 'role' and $2 = any (n.target_roles))
  or (n.audience = 'users' and exists (select 1 from note_recipients r where r.note_id = n.id and r.user_id = $3)))`

/** Validates the audience part of a new note. Returns { error } or { value: { audience, roles, userIds } }. */
export function validateAudience(body = {}) {
  const audience = AUDIENCES.includes(body.audience) ? body.audience : 'all'
  if (audience === 'role') {
    const roles = [...new Set((Array.isArray(body.roles) ? body.roles : []).filter((r) => ROLES[r]))]
    if (!roles.length) return { error: 'اختر دورًا واحدًا على الأقل' }
    return { value: { audience, roles, userIds: [] } }
  }
  if (audience === 'users') {
    const userIds = [...new Set((Array.isArray(body.userIds) ? body.userIds : []).map(String).filter(Boolean))].slice(0, 200)
    if (!userIds.length) return { error: 'اختر شخصًا واحدًا على الأقل' }
    return { value: { audience, roles: [], userIds } }
  }
  return { value: { audience: 'all', roles: [], userIds: [] } }
}

/** Accounts a note with this audience reaches (never the sender). */
export async function audienceUsers(note, senderId) {
  if (note.audience === 'users') {
    return query(`select id, name, role from users where id = any($1) and id <> $2 order by name`, [note.userIds, senderId])
  }
  if (note.audience === 'role') {
    return query(`select id, name, role from users where role = any($1) and id <> $2 order by name`, [note.roles, senderId])
  }
  return query(`select id, name, role from users where id <> $1 order by name`, [senderId])
}

function rowToNote(n, user) {
  return {
    id: n.id,
    message: n.message,
    department: n.department,
    audience: n.audience || 'all',
    targetRoles: n.target_roles || [],
    createdBy: n.created_by,
    createdByName: n.created_by_name,
    createdAt: new Date(n.created_at).toISOString(),
    mine: n.created_by === user.username,
    readAt: n.read_at ? new Date(n.read_at).toISOString() : null,
  }
}

/**
 * Notes `user` may see, newest first. The sender's own notes carry `receipts`:
 * { total, read, readers: [{ name, readAt }], pending: [name] }.
 */
export async function listNotesFor(user, { limit = 50 } = {}) {
  const rows = await query(
    `select n.id, n.message, n.department, n.audience, n.target_roles, n.created_by, n.created_by_name, n.created_at,
            rd.read_at
     from notes n
     left join note_reads rd on rd.note_id = n.id and rd.user_id = $3
     where ${VISIBLE}
     order by n.created_at desc limit ${Number(limit) || 50}`,
    [user.username, user.role, user.id],
  )
  const notes = rows.map((n) => rowToNote(n, user))
  const mine = notes.filter((n) => n.mine)
  if (mine.length) {
    // Audience members per own note, with their read time if any (sender excluded).
    const rec = await query(
      `select n.id as note_id, u.name, rd.read_at
       from notes n
       join users u on u.id <> $2 and (
            n.audience = 'all'
         or (n.audience = 'role' and u.role = any (n.target_roles))
         or (n.audience = 'users' and exists (select 1 from note_recipients r where r.note_id = n.id and r.user_id = u.id)))
       left join note_reads rd on rd.note_id = n.id and rd.user_id = u.id
       where n.id = any($1)
       order by u.name`,
      [mine.map((n) => n.id), user.id],
    )
    for (const n of mine) {
      const list = rec.filter((r) => r.note_id === n.id)
      const readers = list.filter((r) => r.read_at).map((r) => ({ name: r.name, readAt: new Date(r.read_at).toISOString() }))
      n.receipts = { total: list.length, read: readers.length, readers, pending: list.filter((r) => !r.read_at).map((r) => r.name) }
    }
  }
  return notes
}

/** Marks notes as read by `user` (only notes visible to them, never their own). Returns how many were new. */
export async function markNotesRead(user, ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean))].slice(0, 100)
  if (!list.length) return 0
  const rows = await query(
    `insert into note_reads (note_id, user_id)
     select n.id, $3 from notes n
     where n.id = any($4) and n.created_by <> $1 and ${VISIBLE}
     on conflict do nothing
     returning note_id`,
    [user.username, user.role, user.id, list],
  )
  return rows.length
}

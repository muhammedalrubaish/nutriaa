// Creates the system admin, or resets their password, from env vars:
//   ADMIN_USERNAME, ADMIN_PASSWORD (>= 6 chars), optional ADMIN_NAME.
// This is also the recovery path if the system admin's password is lost: the app itself
// cannot create, promote or reset a system admin. There is only ever one.
// No credentials live in the repository.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { loadEnv, connect } from './_db.mjs'

loadEnv()
const username = (process.env.ADMIN_USERNAME || '').trim()
const password = process.env.ADMIN_PASSWORD || ''
const name = (process.env.ADMIN_NAME || 'مدير النظام').trim()

if (!username || password.length < 6) {
  console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 6 characters).')
  process.exit(1)
}

const client = connect()
await client.connect()
try {
  const hash = await bcrypt.hash(password, 10)
  const current = (await client.query(`select username from users where role = 'sysadmin'`)).rows[0]
  if (current && current.username !== username) {
    console.error(
      `The system admin is "${current.username}". Run with ADMIN_USERNAME=${current.username} to reset that password; ` +
        'there can only be one system admin.',
    )
    process.exitCode = 1
  } else {
    const id = 'u_' + crypto.randomBytes(8).toString('hex')
    const { rows } = await client.query(
      `insert into users (id, username, name, role, password_hash)
       values ($1, $2, $3, 'sysadmin', $4)
       on conflict (username) do update set password_hash = excluded.password_hash, role = 'sysadmin'
       returning id, (xmax = 0) as inserted`,
      [id, username, name, hash],
    )
    console.log(rows[0].inserted ? `created system admin "${username}"` : `updated system admin "${username}"`)
  }
} finally {
  await client.end()
}

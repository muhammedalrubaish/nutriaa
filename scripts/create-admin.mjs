// Creates (or resets the password of) a supervisor account from env vars:
//   ADMIN_USERNAME, ADMIN_PASSWORD (>= 6 chars), optional ADMIN_NAME.
// No credentials live in the repository.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { loadEnv, connect } from './_db.mjs'

loadEnv()
const username = (process.env.ADMIN_USERNAME || '').trim()
const password = process.env.ADMIN_PASSWORD || ''
const name = (process.env.ADMIN_NAME || 'مشرف قسم التغذية').trim()

if (!username || password.length < 6) {
  console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 6 characters).')
  process.exit(1)
}

const client = connect()
await client.connect()
try {
  const hash = await bcrypt.hash(password, 10)
  const id = 'u_' + crypto.randomBytes(8).toString('hex')
  const { rows } = await client.query(
    `insert into users (id, username, name, role, password_hash)
     values ($1, $2, $3, 'supervisor', $4)
     on conflict (username) do update set password_hash = excluded.password_hash, role = 'supervisor'
     returning id, (xmax = 0) as inserted`,
    [id, username, name, hash],
  )
  console.log(rows[0].inserted ? `created supervisor "${username}"` : `updated supervisor "${username}"`)
} finally {
  await client.end()
}

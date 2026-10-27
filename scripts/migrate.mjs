// Applies db/migrations/*.sql in filename order, once each.
// Alternative: paste the same files into the Supabase SQL Editor in order.
import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './_db.mjs'

loadEnv()
const dir = path.join(process.cwd(), 'db', 'migrations')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const client = connect()
await client.connect()
try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`)
  await client.query('alter table schema_migrations enable row level security')
  const { rows } = await client.query('select name from schema_migrations')
  const done = new Set(rows.map((r) => r.name))
  for (const f of files) {
    if (done.has(f)) continue
    const sql = fs.readFileSync(path.join(dir, f), 'utf8')
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into schema_migrations (name) values ($1)', [f])
      await client.query('commit')
      console.log('applied', f)
    } catch (e) {
      await client.query('rollback')
      throw new Error(`${f}: ${e.message}`)
    }
  }
  console.log('migrations up to date')
} finally {
  await client.end()
}

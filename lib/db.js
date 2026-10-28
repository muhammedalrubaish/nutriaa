// Server-only Postgres access (Supabase). Uses the pooled connection string in
// DATABASE_URL (Supabase "Transaction pooler", port 6543). Never import from client code.
import pg from 'pg'

const globalForPg = globalThis

function getPool() {
  if (!globalForPg.__nutriPool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not configured')
    const local = /localhost|127\.0\.0\.1/.test(url)
    globalForPg.__nutriPool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
    })
  }
  return globalForPg.__nutriPool
}

/** Runs a parameterised query and returns the rows. */
export async function query(text, params = []) {
  const res = await getPool().query(text, params)
  return res.rows
}

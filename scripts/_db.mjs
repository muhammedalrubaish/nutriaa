// Shared helpers for the CLI scripts (migrate, create-admin).
import pg from 'pg'

export function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      process.loadEnvFile?.(f)
    } catch {}
  }
}

export function connect() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  const local = /localhost|127\.0\.0\.1/.test(url)
  return new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })
}

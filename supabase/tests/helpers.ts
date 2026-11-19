// Shared test setup: an in-memory Postgres with a stand-in for Supabase's "auth" schema,
// the "anon" and "authenticated" roles, and every migration applied.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const migrationsDir = join(__dirname, '..', 'migrations')

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    -- same idea as Supabase: the caller's id comes from the login token
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
  `)
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrationsDir, f), 'utf8'))
  }
  // Supabase gives these roles table and function access by default; row-level security does the filtering
  await db.exec(`
    grant usage on schema public, auth to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to anon, authenticated;
    grant execute on all functions in schema public to anon, authenticated;
  `)
  return db
}

// Runs fn as a logged-in user (uid) or as the anonymous role (uid = null), like the browser would.
export async function asUser<T>(db: PGlite, uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return await fn()
  } finally {
    await db.exec(`reset role`)
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

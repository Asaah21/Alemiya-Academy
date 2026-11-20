// T22: a parent sees nothing directly, and parent_me() says which child they belong to.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const me = (uid: string | null) => asUser(db, uid, async () => (await db.query<{ student_id: string; full_name: string; class_name: string; school_name: string }>(`select * from parent_me()`)).rows)

beforeAll(async () => {
  db = await createTestDb()
  id.parent = await one(`insert into auth.users (email) values ('alm-2026-001@parents.alemiya.school') returning id`)
  id.parent2 = await one(`insert into auth.users (email) values ('alm-2026-002@parents.alemiya.school') returning id`)
  id.stranger = await one(`insert into auth.users (email) values ('x@y.z') returning id`)
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff')`)
  await db.exec(`update settings set school_name = 'Alemiya Academy'`).catch(() => {})
  if ((await db.query(`select 1 from settings`)).rows.length === 0) await db.exec(`insert into settings (school_name) values ('Alemiya Academy')`)
  const c = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.ama = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [c])
  id.kofi = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [c])
  await db.exec(`insert into parent_access (student_id, code_hash, auth_user_id) values ('${id.ama}','h','${id.parent}'), ('${id.kofi}','h','${id.parent2}')`)
})

describe('parent_me', () => {
  it('tells a parent which child they belong to', async () => {
    const r = await me(id.parent)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ student_id: id.ama, full_name: 'Ama', class_name: 'Basic 3', school_name: 'Alemiya Academy' })
  })

  it('returns nothing for Staff, a stranger and a logged-out visitor', async () => {
    expect(await me(id.staff)).toEqual([])
    expect(await me(id.stranger)).toEqual([])
    expect(await me(null)).toEqual([])
  })

  it('returns nothing once access is stopped or the student has left', async () => {
    await db.exec(`update parent_access set active = false where student_id = '${id.ama}'`)
    expect(await me(id.parent)).toEqual([])
    await db.exec(`update parent_access set active = true where student_id = '${id.ama}'`)
    await db.exec(`update students set status = 'withdrawn' where id = '${id.kofi}'`)
    expect(await me(id.parent2)).toEqual([])
    await db.exec(`update students set status = 'active' where id = '${id.kofi}'`)
    expect(await me(id.parent2)).toHaveLength(1)
  })

  it('notes the first login, and does not rewrite it within the hour', async () => {
    const first = (await db.query<{ last_login: string }>(`select last_login from parent_access where student_id = '${id.ama}'`)).rows[0].last_login
    expect(first).not.toBeNull()
    await me(id.parent)
    const again = (await db.query<{ last_login: string }>(`select last_login from parent_access where student_id = '${id.ama}'`)).rows[0].last_login
    expect(again).toEqual(first)
  })
})

describe('a parent has no direct access to any table', () => {
  it('reads no rows from any table in the public schema', async () => {
    const tables = (await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'public'`)).rows.map((r) => r.tablename)
    expect(tables.length).toBeGreaterThan(10)
    for (const t of tables) {
      const n = await asUser(db, id.parent, async () => (await db.query<{ n: number }>(`select count(*)::int as n from public.${t}`)).rows[0].n)
      expect([t, n]).toEqual([t, 0])
    }
  })

  it('cannot write either', async () => {
    await expect(asUser(db, id.parent, () => db.query(`insert into payments (student_id, term_id, amount, receipt_no) values ($1, gen_random_uuid(), 1, 'X')`, [id.ama]))).rejects.toThrow()
    await asUser(db, id.parent, () => db.query(`update students set full_name = 'Hacked'`))
    expect((await db.query<{ full_name: string }>(`select full_name from students where id = $1`, [id.ama])).rows[0].full_name).toBe('Ama')
  })
})

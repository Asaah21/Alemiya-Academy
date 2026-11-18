// T05: switching the current term works for Admin only and keeps exactly one current term and year.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id

beforeAll(async () => {
  db = await createTestDb()
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.admin}','Head','admin'), ('${id.staff}','Teacher','staff')`)
  id.y1 = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2025/2026','2025-09-01','2026-07-31',true) returning id`)
  id.y2 = await one(`insert into academic_years (name,start_date,end_date) values ('2026/2027','2026-09-01','2027-07-31') returning id`)
  id.t1 = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2025-09-01','2025-12-15',true) returning id`, [id.y1])
  id.t2 = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 1','2026-09-01','2026-12-15') returning id`, [id.y2])
})

const current = async () => ({
  terms: (await db.query<{ id: string }>(`select id from terms where is_current`)).rows.map((r) => r.id),
  years: (await db.query<{ id: string }>(`select id from academic_years where is_current`)).rows.map((r) => r.id),
})

describe('set_current_term', () => {
  it('Staff cannot change the current term', async () => {
    await expect(asUser(db, id.staff, () => db.query(`select set_current_term($1)`, [id.t2]))).rejects.toThrow()
    expect(await current()).toEqual({ terms: [id.t1], years: [id.y1] })
  })

  it('Admin moves the current term and year together', async () => {
    await asUser(db, id.admin, () => db.query(`select set_current_term($1)`, [id.t2]))
    expect(await current()).toEqual({ terms: [id.t2], years: [id.y2] })
  })

  it('rejects an unknown term', async () => {
    await expect(asUser(db, id.admin, () => db.query(`select set_current_term(gen_random_uuid())`))).rejects.toThrow()
  })
})

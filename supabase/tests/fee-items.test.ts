// T17: fee items are Admin-only to change; changes and removals are kept in history.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const hist = async () => (await db.query<{ n: number }>(`select count(*)::int as n from history where table_name = 'fee_items'`)).rows[0].n

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff'), ('${id.admin}','Head','admin')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
})

describe('fee_items', () => {
  it('lets the Admin add, and Staff only read', async () => {
    await asUser(db, id.admin, () => db.query(`insert into fee_items (class_id, term_id, name, amount) values ($1,$2,'School fees',300)`, [id.cls, id.term]))
    const staffSees = await asUser(db, id.staff, () => db.query(`select name from fee_items`))
    expect(staffSees.rows).toHaveLength(1)
    await expect(asUser(db, id.staff, () => db.query(`insert into fee_items (class_id, term_id, name, amount) values ($1,$2,'PTA',20)`, [id.cls, id.term]))).rejects.toThrow()
  })

  it('refuses a negative amount', async () => {
    await expect(asUser(db, id.admin, () => db.query(`insert into fee_items (class_id, term_id, name, amount) values ($1,$2,'Bad',-1)`, [id.cls, id.term]))).rejects.toThrow()
  })

  it('keeps the old row in history on change and on removal', async () => {
    const before = await hist()
    await asUser(db, id.admin, () => db.query(`update fee_items set amount = 350 where name = 'School fees'`))
    expect(await hist()).toBe(before + 1)
    await asUser(db, id.admin, () => db.query(`delete from fee_items where name = 'School fees'`))
    expect(await hist()).toBe(before + 2)
  })

  it('does not let Staff remove an item', async () => {
    await db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${id.cls}','${id.term}','Books',50)`)
    await asUser(db, id.staff, () => db.query(`delete from fee_items`))
    expect((await db.query(`select 1 from fee_items`)).rows).toHaveLength(1)
  })
})

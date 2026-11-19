// T18: recording payments and receipt numbers.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const today = new Date().toISOString().slice(0, 10)
const year = today.slice(0, 4)
const pay = (uid: string, amount: number, date = today, note: string | null = null, student = id.a) =>
  asUser(db, uid, async () => (await db.query<{ receipt_no: string }>(`select * from record_payment($1,$2,$3,$4,$5)`, [student, id.term, amount, date, note])).rows[0].receipt_no)

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff'), ('${id.admin}','Head','admin')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.a = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.gone = await one(`insert into students (full_name, gender, class_id, status) values ('Old','male',$1,'withdrawn') returning id`, [id.cls])
})

describe('record_payment', () => {
  it('numbers receipts one after another, for Staff and Admin', async () => {
    expect(await pay(id.staff, 100)).toBe(`R-${year}-0001`)
    expect(await pay(id.admin, 50.5)).toBe(`R-${year}-0002`)
    const row = (await db.query<{ received_by: string; amount: string }>(`select received_by, amount from payments where receipt_no = 'R-${year}-0001'`)).rows[0]
    expect(row.received_by).toBe(id.staff)
    expect(Number(row.amount)).toBe(100)
  })

  it('never reuses the number of a voided payment', async () => {
    await db.exec(`update payments set status='void', void_reason='mistake' where receipt_no = 'R-${year}-0002'`)
    expect(await pay(id.staff, 10)).toBe(`R-${year}-0003`)
  })

  it('refuses zero, negative, 3 decimals, huge, future and very old', async () => {
    for (const a of [0, -5, 10.123, 2000000]) await expect(pay(id.staff, a)).rejects.toThrow()
    await expect(pay(id.staff, 10, '2999-01-01')).rejects.toThrow(/future/)
    await expect(pay(id.staff, 10, '2020-01-01')).rejects.toThrow(/past/)
  })

  it('refuses a student who is not active, and a long note', async () => {
    await expect(pay(id.staff, 10, today, null, id.gone)).rejects.toThrow(/active/)
    await expect(pay(id.staff, 10, today, 'x'.repeat(201))).rejects.toThrow(/200/)
  })

  it('does not let a payment be edited afterwards', async () => {
    await expect(db.exec(`update payments set amount = 1 where receipt_no = 'R-${year}-0001'`)).rejects.toThrow(/cannot be changed/)
  })
})

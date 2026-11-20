// T20: voiding payments.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const today = new Date().toISOString().slice(0, 10)
const record = (uid: string, amount: number) =>
  asUser(db, uid, async () => (await db.query<{ payment_id: string }>(`select * from record_payment($1,$2,$3,$4,null)`, [id.s, id.term, amount, today])).rows[0].payment_id)
const voidIt = (uid: string, pid: string, reason: string) => asUser(db, uid, () => db.query(`select void_payment($1,$2)`, [pid, reason]))
const row = async (pid: string) => (await db.query<{ status: string; void_reason: string | null; voided_by: string | null; voided_at: string | null; amount: string }>(`select * from payments where id = $1`, [pid])).rows[0]

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff'), ('${id.admin}','Head','admin')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
  const c = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.s = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [c])
})

describe('void_payment', () => {
  it('refuses Staff, even for a payment they recorded', async () => {
    const p = await record(id.staff, 100)
    await expect(voidIt(id.staff, p, 'wrong amount')).rejects.toThrow(/Only the Admin/)
    expect((await row(p)).status).toBe('valid')
  })

  it('lets the Admin void with a reason, keeping the record, who and when', async () => {
    const p = await record(id.staff, 80)
    await voidIt(id.admin, p, '  Entered twice ')
    const r = await row(p)
    expect(r.status).toBe('void')
    expect(r.void_reason).toBe('Entered twice')
    expect(r.voided_by).toBe(id.admin)
    expect(r.voided_at).not.toBeNull()
    expect(Number(r.amount)).toBe(80)
  })

  it('needs a reason, and refuses a second void or an unknown payment', async () => {
    const p = await record(id.admin, 10)
    await expect(voidIt(id.admin, p, '  ')).rejects.toThrow(/reason/)
    await expect(voidIt(id.admin, p, 'x'.repeat(201))).rejects.toThrow(/200/)
    await voidIt(id.admin, p, 'mistake')
    await expect(voidIt(id.admin, p, 'again')).rejects.toThrow(/already voided/)
    await expect(voidIt(id.admin, '00000000-0000-0000-0000-000000000000', 'x y z')).rejects.toThrow(/not found/)
  })

  it('takes the voided payment out of the balance', async () => {
    const r = await asUser(db, id.admin, async () => (await db.query<{ paid: string }>(`select paid from fee_balances($1)`, [id.term])).rows[0])
    expect(Number(r.paid)).toBe(100)
  })

  it('does not let a voided payment be changed', async () => {
    await expect(db.exec(`update payments set void_reason = 'new' where status = 'void'`)).rejects.toThrow(/cannot be changed/)
  })
})

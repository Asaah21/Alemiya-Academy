// T19: balances and arrears per student.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
type B = { full_name: string; owed: string; paid: string; balance: string; arrears: string }
const balances = (term: string, cls: string | null = null) =>
  asUser(db, id.staff, async () => (await db.query<B>(`select * from fee_balances($1, $2)`, [term, cls])).rows)
const pay = (student: string, term: string, amount: number, status = 'valid', no = Math.random().toString(36).slice(2)) =>
  db.exec(`insert into payments (student_id, term_id, amount, receipt_no, status, void_reason) values ('${student}','${term}',${amount},'${no}','${status}', ${status === 'void' ? "'mistake'" : 'null'})`)

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.t1 = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 1','2026-09-07','2026-12-18') returning id`, [y])
  id.t2 = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 2','2027-01-10','2027-04-02',true) returning id`, [y])
  id.c3 = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.c4 = await one(`insert into classes (name, level_order) values ('Basic 4', 9) returning id`)
  id.ama = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.c3])
  id.kofi = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.c3])
  id.yaw = await one(`insert into students (full_name, gender, class_id) values ('Yaw','male',$1) returning id`, [id.c4])
  id.gone = await one(`insert into students (full_name, gender, class_id, status) values ('Esi','female',$1,'withdrawn') returning id`, [id.c3])
  for (const t of [id.t1, id.t2]) await db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${id.c3}','${t}','School fees',300), ('${id.c3}','${t}','PTA',20)`)
})

describe('fee_balances', () => {
  it('owed is the class fee total; nobody has paid yet; no arrears in the first term', async () => {
    const r = await balances(id.t1, id.c3)
    expect(r.map((x) => x.full_name)).toEqual(['Ama', 'Kofi'])
    expect(r.map((x) => [Number(x.owed), Number(x.paid), Number(x.balance), Number(x.arrears)])).toEqual([[320, 0, 320, 0], [320, 0, 320, 0]])
  })

  it('counts valid payments only', async () => {
    await pay(id.ama, id.t1, 100)
    await pay(id.ama, id.t1, 50, 'void')
    const ama = (await balances(id.t1, id.c3))[0]
    expect([Number(ama.paid), Number(ama.balance)]).toEqual([100, 220])
  })

  it('carries what is unpaid from earlier terms as arrears, and ahead-payments reduce it', async () => {
    const r = await balances(id.t2, id.c3)
    expect(Number(r[0].arrears)).toBe(220)
    expect(Number(r[1].arrears)).toBe(320)
    await pay(id.kofi, id.t1, 400)
    expect(Number((await balances(id.t2, id.c3))[1].arrears)).toBe(-80)
  })

  it('shows a class with no fees as owing nothing, leaves out students who left, and covers all classes when none is chosen', async () => {
    const all = await balances(id.t2)
    expect(all.map((x) => x.full_name)).toEqual(['Ama', 'Kofi', 'Yaw'])
    expect(Number(all[2].owed)).toBe(0)
  })
})

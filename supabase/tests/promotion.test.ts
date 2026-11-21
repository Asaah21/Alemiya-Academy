// T27: year-end promotion and class history (rule S7).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const run = (uid: string, sql: string, p: unknown[] = []) => asUser(db, uid, () => db.query(sql, p))
const klass = async (sid: string) => (await db.query<{ class_id: string; status: string }>(`select class_id, status from students where id = $1`, [sid])).rows[0]
const promote = (uid: string, repeaters: string[], date: string) => run(uid, `select * from promote_year($1, $2::uuid[], $3)`, [id.year, repeaters, date])

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff'), ('${id.admin}','Head','admin')`)
  id.year = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2025/2026','2025-09-01','2026-07-31',true) returning id`)
  id.t1 = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2025-09-08','2025-12-19',true) returning id`, [id.year])
  id.t3 = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 3','2026-04-27','2026-07-17') returning id`, [id.year])
  id.b5 = await one(`insert into classes (name, level_order) values ('Basic 5', 10) returning id`)
  id.b6 = await one(`insert into classes (name, level_order) values ('Basic 6', 11) returning id`)
  id.jhs3 = await one(`insert into classes (name, level_order) values ('JHS 3', 14) returning id`)
  const mk = async (n: string, c: string, status = 'active') => one(`insert into students (full_name, gender, class_id, status) values ($1,'male',$2,$3) returning id`, [n, c, status])
  id.ama = await mk('Ama', id.b5); id.kofi = await mk('Kofi', id.b5); id.esi = await mk('Esi', id.b6); id.yaw = await mk('Yaw', id.jhs3)
  id.gone = await mk('Gone', id.b5, 'withdrawn')
  // fees: Basic 5 pays 300, Basic 6 pays 500 in Term 1; Ama has paid 100
  await db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${id.b5}','${id.t1}','Fees',300), ('${id.b6}','${id.t1}','Fees',500)`)
  await db.exec(`insert into payments (student_id, term_id, amount, receipt_no) values ('${id.ama}','${id.t1}',100,'R-1')`)
  // the movement trigger dated everyone today; make them all start before Term 1 so history is realistic
  await db.exec(`update student_movements set moved_on = '2025-08-01'`)
})

describe('before the year is finished', () => {
  it('refuses Staff', async () => {
    await expect(promote(id.staff, [], '2026-08-01')).rejects.toThrow(/Only the Admin/)
  })
  it('refuses while a term of the year is still open', async () => {
    await expect(promote(id.admin, [], '2026-08-01')).rejects.toThrow(/Close every term/)
  })
})

describe('promote_year', () => {
  beforeAll(async () => { await db.exec(`update terms set status = 'closed'`) })

  it('needs a date after the last term and not in the future', async () => {
    await expect(promote(id.admin, [], '2026-07-17')).rejects.toThrow(/after the last term/)
    await expect(promote(id.admin, [], '2999-01-01')).rejects.toThrow(/future/)
  })

  it('moves classes up, keeps repeaters, graduates the last class and leaves others alone', async () => {
    const r = (await promote(id.admin, [id.kofi], '2026-07-18')).rows[0] as { promoted: number; repeated: number; graduated: number }
    expect(r).toEqual({ promoted: 2, repeated: 1, graduated: 1 })
    expect((await klass(id.ama)).class_id).toBe(id.b6) // Basic 5 -> Basic 6
    expect((await klass(id.esi)).class_id).toBe(id.jhs3) // Basic 6 -> JHS 3 (next by order, skipping nothing)
    expect((await klass(id.kofi)).class_id).toBe(id.b5) // repeater stays
    expect(await klass(id.yaw)).toMatchObject({ class_id: id.jhs3, status: 'graduated' })
    expect((await klass(id.gone)).class_id).toBe(id.b5) // not active: untouched
  })

  it('writes every change into the history with a date', async () => {
    const rows = (await db.query<{ full_name: string; movement: string }>(`select s.full_name, m.movement from student_movements m join students s on s.id = m.student_id where m.moved_on = '2026-07-18' order by s.full_name`)).rows
    expect(rows).toEqual([{ full_name: 'Ama', movement: 'promoted' }, { full_name: 'Esi', movement: 'promoted' }, { full_name: 'Kofi', movement: 'repeated' }, { full_name: 'Yaw', movement: 'graduated' }])
  })

  it('cannot be run twice for the same year', async () => {
    await expect(promote(id.admin, [], '2026-07-19')).rejects.toThrow(/already been done/)
  })
})

describe('class history', () => {
  it('says which class a student was in on a date', async () => {
    const on = async (s: string, d: string) => (await db.query<{ c: string | null }>(`select student_class_on($1, $2) as c`, [s, d])).rows[0].c
    expect(await on(id.ama, '2025-12-19')).toBe(id.b5)
    expect(await on(id.ama, '2026-07-18')).toBe(id.b6)
    expect(await on(id.ama, '2025-01-01')).toBe(id.b5) // before admission: the first class recorded
  })

  it('works out old arrears from the fees of the class the student was in then', async () => {
    id.y2 = await one(`insert into academic_years (name,start_date,end_date) values ('2026/2027','2026-09-01','2027-07-31') returning id`)
    id.n1 = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 1','2026-09-07','2026-12-18') returning id`, [id.y2])
    const b = (await db.query<{ full_name: string; arrears: string }>(`select full_name, arrears from fee_balances($1)`, [id.n1])).rows
    // Ama was in Basic 5 in Term 1 (300 fee, paid 100): arrears 200, NOT Basic 6's 500
    expect(Number(b.find((x) => x.full_name === 'Ama')!.arrears)).toBe(200)
    expect(Number(b.find((x) => x.full_name === 'Esi')!.arrears)).toBe(500) // was in Basic 6 then
  })
})

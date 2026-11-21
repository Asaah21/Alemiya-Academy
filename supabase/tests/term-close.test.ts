// T26: term close, snapshot, lock and reopen (rules S5, S6, S8).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const run = (uid: string, sql: string, p: unknown[] = []) => asUser(db, uid, () => db.query(sql, p))
const check = async () => (await run(id.admin, `select term_close_check($1) as c`, [id.t1])).rows[0] as { c: any }

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff'), ('${id.admin}','Head','admin')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-01-01','2026-12-31',true) returning id`)
  // Term 1: Mon 5 Jan to Fri 16 Jan 2026 (two school weeks), in the past
  id.t1 = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-01-05','2026-01-16',true) returning id`, [y])
  id.t2 = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 2','2026-04-27','2026-07-31') returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.eng = await one(`insert into subjects (name, type) values ('English','core') returning id`)
  await db.exec(`insert into class_subjects (class_id, subject_id) values ('${id.cls}','${id.eng}')`)
  id.ama = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.kofi = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.cls])
  id.tch = await one(`insert into staff (full_name) values ('Mr Mensah') returning id`)
  await db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${id.cls}','${id.t1}','School fees',300)`)
  await db.exec(`insert into payments (student_id, term_id, amount, receipt_no) values ('${id.ama}','${id.t1}',100,'R-1')`)
})

describe('term_close_check', () => {
  it('lists missing attendance weeks, incomplete scores and unrecorded staff days', async () => {
    const { c } = await check()
    expect(c.weeks_missing).toHaveLength(1)
    expect(c.weeks_missing[0].weeks).toEqual(['2026-01-05', '2026-01-12'])
    expect(c.scores_missing[0]).toMatchObject({ class_name: 'Basic 3', students: 2, incomplete: 2 })
    expect(c.staff_days_missing).toBe(10)
  })
})

describe('close_term', () => {
  it('refuses Staff', async () => {
    await expect(run(id.staff, `select close_term($1, true)`, [id.t1])).rejects.toThrow(/Only the Admin/)
  })
  it('refuses while there are gaps unless the Admin accepts them', async () => {
    await expect(run(id.admin, `select close_term($1)`, [id.t1])).rejects.toThrow(/gaps/)
    expect((await db.query(`select status from terms where id = '${id.t1}'`)).rows[0]).toEqual({ status: 'open' })
  })

  it('closes with accepted gaps, saving a snapshot with the numbers as they stood', async () => {
    await db.exec(`insert into scores (student_id, subject_id, term_id, class_score, exam_score) values ('${id.ama}','${id.eng}','${id.t1}',25,60)`)
    await run(id.admin, `select close_term($1, true)`, [id.t1])
    expect((await db.query(`select status from terms where id = '${id.t1}'`)).rows[0]).toEqual({ status: 'closed' })
    const snap = (await db.query<{ data: any }>(`select data from term_snapshots where term_id = '${id.t1}'`)).rows
    expect(snap).toHaveLength(1)
    const d = snap[0].data
    expect(d.term).toMatchObject({ name: 'Term 1', year: '2026/2027' })
    expect(d.students.map((s: { full_name: string }) => s.full_name)).toEqual(['Ama', 'Kofi'])
    expect(d.fees.find((f: { full_name: string }) => f.full_name === 'Ama')).toMatchObject({ owed: 300, paid: 100, balance: 200 })
    expect(d.results.find((r: { student_id: string }) => r.student_id === id.ama)).toMatchObject({ subjects_scored: 1, overall: 85 })
    expect(d.turnover.length).toBeGreaterThan(0)
    expect(d.check.staff_days_missing).toBe(10)
  })

  it('refuses to close twice', async () => {
    await expect(run(id.admin, `select close_term($1, true)`, [id.t1])).rejects.toThrow(/already closed/)
  })
})

describe('a closed term is locked, even for direct requests', () => {
  const tries: [string, string][] = [
    ['scores', `update scores set class_score = 1`],
    ['new scores', `insert into scores (student_id, subject_id, term_id, class_score, exam_score) values ('KOFI','ENG','T1',1,1)`],
    ['remarks', `insert into report_remarks (student_id, term_id, teacher_remark) values ('AMA','T1','x')`],
    ['attendance week', `insert into attendance_weeks (class_id, term_id, week_start) values ('CLS','T1','2026-01-05')`],
    ['staff attendance', `insert into staff_attendance (staff_id, attendance_date, term_id, status) values ('TCH','2026-01-06','T1','present')`],
    ['holiday', `insert into non_school_days (non_school_date, reason) values ('2026-01-07','x')`],
    ['fee item', `update fee_items set amount = 1`],
    ['new payment', `insert into payments (student_id, term_id, amount, receipt_no) values ('AMA','T1',5,'R-9')`],
    ['payment amount', `update payments set amount = 1`],
  ]
  for (const [label, sql] of tries) {
    it(`blocks ${label}`, async () => {
      const q = sql.replace('KOFI', id.kofi).replace('ENG', id.eng).replace(/AMA/g, id.ama).replace(/T1/g, id.t1).replace('CLS', id.cls).replace('TCH', id.tch)
      await expect(db.query(q)).rejects.toThrow(/closed|cannot be changed/)
    })
  }

  it('still lets the Admin void a payment, and publish or unpublish results', async () => {
    await run(id.admin, `select void_payment((select id from payments where receipt_no = 'R-1'), 'entered twice')`)
    expect((await db.query(`select status from payments where receipt_no = 'R-1'`)).rows[0]).toEqual({ status: 'void' })
    await run(id.admin, `insert into results_publish (class_id, term_id) values ($1, $2)`, [id.cls, id.t1])
  })

  it('does not touch another term', async () => {
    await db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${id.cls}','${id.t2}','School fees',300)`)
  })
})

describe('reopen_term', () => {
  it('needs the Admin and a reason', async () => {
    await expect(run(id.staff, `select reopen_term($1, 'oops')`, [id.t1])).rejects.toThrow(/Only the Admin/)
    await expect(run(id.admin, `select reopen_term($1, '  ')`, [id.t1])).rejects.toThrow(/reason/)
  })
  it('refuses while a later term is closed', async () => {
    await db.exec(`update terms set status = 'closed' where id = '${id.t2}'`)
    await expect(run(id.admin, `select reopen_term($1, 'fix a score')`, [id.t1])).rejects.toThrow(/later term is closed/)
    await db.exec(`update terms set status = 'open' where id = '${id.t2}'`)
  })
  it('reopens, keeps the reason on the snapshot, allows corrections, and a second close makes a new snapshot', async () => {
    await run(id.admin, `select reopen_term($1, 'Fix a wrong exam score')`, [id.t1])
    expect((await db.query(`select reopened_reason from term_snapshots where term_id = '${id.t1}'`)).rows[0]).toEqual({ reopened_reason: 'Fix a wrong exam score' })
    await db.exec(`update scores set exam_score = 65`)
    await run(id.admin, `select close_term($1, true)`, [id.t1])
    const snaps = (await db.query<{ data: any }>(`select data from term_snapshots where term_id = '${id.t1}' order by closed_at`)).rows
    expect(snaps).toHaveLength(2)
    expect(snaps[0].data.results.find((r: { student_id: string }) => r.student_id === id.ama).overall).toBe(85)
    expect(snaps[1].data.results.find((r: { student_id: string }) => r.student_id === id.ama).overall).toBe(90)
  })
})

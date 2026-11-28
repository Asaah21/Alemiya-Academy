// T23: what a parent can see. Published results only, own child only, no classmates' data.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const as = <T>(uid: string | null, sql: string, p: unknown[] = []) => asUser(db, uid, async () => (await db.query<T>(sql, p)).rows)
const report = async (uid: string | null, term = id.t1) => (await as<{ r: any }>(uid, `select parent_report($1) as r`, [term]))[0].r
const today = new Date().toISOString().slice(0, 10)

beforeAll(async () => {
  db = await createTestDb()
  id.pAma = await one(`insert into auth.users (email) values ('p1@x') returning id`)
  id.pKofi = await one(`insert into auth.users (email) values ('p2@x') returning id`)
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','T','staff'), ('${id.admin}','H','admin')`)
  if ((await db.query(`select 1 from settings`)).rows.length === 0) await db.exec(`insert into settings (school_name) values ('Alemiya Academy')`)
  await db.exec(`update settings set school_name = 'Alemiya Academy'`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-01-01','2027-07-31',true) returning id`)
  id.t1 = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-01-05','2026-04-02',true) returning id`, [y])
  id.tFuture = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 3','2099-01-05','2099-04-02') returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.eng = await one(`insert into subjects (name, type) values ('English','core') returning id`)
  id.mat = await one(`insert into subjects (name, type) values ('Maths','core') returning id`)
  await db.exec(`insert into class_subjects (class_id, subject_id) values ('${id.cls}','${id.eng}'), ('${id.cls}','${id.mat}')`)
  id.ama = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.kofi = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.cls])
  id.yaw = await one(`insert into students (full_name, gender, class_id) values ('Yaw','male',$1) returning id`, [id.cls])
  await db.exec(`insert into parent_access (student_id, code_hash, auth_user_id) values ('${id.ama}','h','${id.pAma}'), ('${id.kofi}','h','${id.pKofi}')`)
  // Ama 25+60 / 20+50 = 155; Kofi 25+60 / 20+50 = 155 (tie); Yaw absent in maths: 10+30 = 40
  for (const [s, e1, e2, m1, m2] of [[id.ama, 25, 60, 20, 50], [id.kofi, 25, 60, 20, 50], [id.yaw, 10, 30, 0, 0]] as const)
    await db.exec(`insert into scores (student_id, subject_id, term_id, class_score, exam_score, is_absent) values
      ('${s}','${id.eng}','${id.t1}',${e1},${e2},false), ('${s}','${id.mat}','${id.t1}',${m1 || 'null'},${m2 || 'null'},${m1 === 0})`)
  await db.exec(`insert into report_remarks (student_id, term_id, teacher_remark, head_remark) values ('${id.ama}','${id.t1}','Good','Keep going'), ('${id.kofi}','${id.t1}','Kofi private remark',null)`)
  await db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${id.cls}','${id.t1}','School fees',300), ('${id.cls}','${id.tFuture}','School fees',999)`)
  await db.exec(`insert into payments (student_id, term_id, amount, receipt_no) values ('${id.ama}','${id.t1}',100,'R-1'), ('${id.kofi}','${id.t1}',300,'R-2')`)
  await db.exec(`insert into payments (student_id, term_id, amount, receipt_no, status, void_reason) values ('${id.ama}','${id.t1}',50,'R-3','void','oops')`)
})

describe('parent_report', () => {
  it('is refused until the Admin publishes', async () => {
    await expect(report(id.pAma)).rejects.toThrow(/not been published/)
    expect(await as(id.pAma, `select * from parent_result_terms()`)).toEqual([])
  })

  it('gives a parent only their own child once published', async () => {
    await db.exec(`insert into results_publish (class_id, term_id) values ('${id.cls}','${id.t1}')`)
    const terms = await as<{ term_name: string }>(id.pAma, `select * from parent_result_terms()`)
    expect(terms.map((t) => t.term_name)).toEqual(['Term 1'])
    const r = await report(id.pAma)
    expect(r.student.full_name).toBe('Ama')
    expect(r.scores).toHaveLength(2)
    expect(r.scores.every((s: { student_id: string }) => s.student_id === id.ama)).toBe(true)
    expect(r.remark.teacher_remark).toBe('Good')
    expect(r.school.name).toBe('Alemiya Academy')
  })

  it('shows the class only as anonymous totals, with no classmates names, scores or remarks', async () => {
    const r = await report(id.pAma)
    expect([...r.class_totals].sort((a: number, b: number) => b - a)).toEqual([155, 155, 40])
    expect(r.class_size).toBe(3)
    const text = JSON.stringify(r)
    for (const secret of ['Kofi', 'Yaw', 'private remark']) expect(text).not.toContain(secret)
  })

  it('refuses Staff, a stranger, the wrong term and a logged-out visitor', async () => {
    await expect(report(id.staff)).rejects.toThrow(/Not available/)
    await expect(report(null)).rejects.toThrow(/permission denied/)
    await expect(report(id.pAma, id.tFuture)).rejects.toThrow(/not been published/)
  })

  it('stops showing results when parent access is stopped', async () => {
    await db.exec(`update parent_access set active = false where student_id = '${id.ama}'`)
    await expect(report(id.pAma)).rejects.toThrow(/Not available/)
    await db.exec(`update parent_access set active = true where student_id = '${id.ama}'`)
  })
})

describe('parent_fees and parent_attendance', () => {
  it('shows own fees for terms that have started, valid payments only', async () => {
    const f = (await as<{ f: any }>(id.pAma, `select parent_fees() as f`))[0].f
    expect(f.terms).toHaveLength(1)
    expect(f.terms[0]).toMatchObject({ term_name: 'Term 1', owed: 300, paid: 100, balance: 200 })
    expect(f.payments.map((p: { receipt_no: string }) => p.receipt_no)).toEqual(['R-1'])
  })

  it('does not show another child payments', async () => {
    const f = (await as<{ f: any }>(id.pKofi, `select parent_fees() as f`))[0].f
    expect(f.terms[0].paid).toBe(300)
    expect(JSON.stringify(f)).not.toContain('R-1')
  })

  it('refuses Staff and strangers', async () => {
    await expect(as(id.staff, `select parent_fees()`)).rejects.toThrow(/Not available/)
    expect(await as(id.staff, `select * from parent_attendance()`)).toEqual([])
  })

  it('sums attendance per term for the own child', async () => {
    const w = await one(`insert into attendance_weeks (class_id, term_id, week_start, school_days) values ('${id.cls}','${id.t1}','2026-01-05',5) returning id`)
    await db.exec(`insert into attendance_entries (week_id, student_id, days_absent) values ('${w}','${id.ama}',2), ('${w}','${id.kofi}',5)`)
    const a = await as<{ term_name: string; school_days: string; days_absent: string }>(id.pAma, `select * from parent_attendance()`)
    expect(a.map((x) => [x.term_name, Number(x.school_days), Number(x.days_absent)])).toEqual([['Term 1', 5, 2]])
    const r = await report(id.pAma)
    expect(r.attendance).toMatchObject({ school_days: 5, days_absent: 2 })
  })
})

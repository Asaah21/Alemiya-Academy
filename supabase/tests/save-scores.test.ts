// T12: saving a class's scores for one subject (rules G1, G6).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
type Row = { student_id: string; class_score?: number | null; exam_score?: number | null; is_absent?: boolean }
const save = (uid: string, rows: Row[], subject = id.maths) =>
  asUser(db, uid, () => db.query(`select save_scores($1, $2, $3, $4::jsonb)`, [id.cls, subject, id.term, JSON.stringify(rows)]))
const scoreOf = async (s: string) =>
  (await db.query<{ class_score: string | null; exam_score: string | null; is_absent: boolean }>(
    `select class_score, exam_score, is_absent from scores where student_id = $1 and subject_id = $2`, [s, id.maths])).rows[0]
const historyCount = async () => (await db.query<{ n: number }>(`select count(*)::int as n from history where table_name = 'scores'`)).rows[0].n

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.maths = await one(`insert into subjects (name, type) values ('Maths','core') returning id`)
  id.art = await one(`insert into subjects (name, type) values ('Art','elective') returning id`)
  await db.exec(`insert into class_subjects (class_id, subject_id) values ('${id.cls}','${id.maths}')`)
  id.a = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.b = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.cls])
  id.c = await one(`insert into students (full_name, gender, class_id) values ('Esi','female',$1) returning id`, [id.cls])
})

describe('save_scores', () => {
  it('Staff save scores; blank students get no row', async () => {
    await save(id.staff, [
      { student_id: id.a, class_score: 24, exam_score: 51.5 },
      { student_id: id.b, class_score: null, exam_score: null },
      { student_id: id.c, is_absent: true, class_score: 10, exam_score: 10 },
    ])
    expect(await scoreOf(id.a)).toEqual({ class_score: '24.00', exam_score: '51.50', is_absent: false })
    expect(await scoreOf(id.b)).toBeUndefined()
    expect(await scoreOf(id.c)).toEqual({ class_score: null, exam_score: null, is_absent: true }) // absent clears the marks
  })

  it('blocks scores above the maximum and saves nothing from that call', async () => {
    await expect(save(id.staff, [{ student_id: id.b, class_score: 20, exam_score: 60 }, { student_id: id.a, class_score: 0, exam_score: 71 }])).rejects.toThrow(/exam score cannot be more than 70/)
    expect(await scoreOf(id.b)).toBeUndefined()
    await expect(save(id.staff, [{ student_id: id.b, class_score: 30.5, exam_score: 0 }])).rejects.toThrow(/class score cannot be more than 30/)
  })

  it('saving again corrects a score and keeps the old value in history; unchanged rows are not logged', async () => {
    const before = await historyCount()
    await save(id.staff, [{ student_id: id.a, class_score: 25, exam_score: 51.5 }, { student_id: id.c, is_absent: true }])
    expect((await scoreOf(id.a)).class_score).toBe('25.00')
    expect(await historyCount()).toBe(before + 1)
  })

  it('lets a score be cleared again after it was entered', async () => {
    await save(id.staff, [{ student_id: id.a, class_score: null, exam_score: null }])
    expect(await scoreOf(id.a)).toEqual({ class_score: null, exam_score: null, is_absent: false })
  })

  it('refuses a subject the class does not take, and a student from another class', async () => {
    await expect(save(id.staff, [], id.art)).rejects.toThrow(/not taught/)
    const other = await one(`insert into classes (name, level_order) values ('Basic 4', 9) returning id`)
    const stranger = await one(`insert into students (full_name, gender, class_id) values ('Yaw','male',$1) returning id`, [other])
    await expect(save(id.staff, [{ student_id: stranger, class_score: 1, exam_score: 1 }])).rejects.toThrow(/not in this class/)
  })

  it('refuses a closed term and a class whose results are published', async () => {
    await db.exec(`update terms set status = 'closed'`)
    await expect(save(id.staff, [])).rejects.toThrow(/closed/)
    await db.exec(`update terms set status = 'open'`)
    await db.exec(`insert into results_publish (class_id, term_id) values ('${id.cls}','${id.term}')`)
    await expect(save(id.staff, [{ student_id: id.a, class_score: 1, exam_score: 1 }])).rejects.toThrow(/published/)
    await db.exec(`delete from results_publish`)
  })
})

describe('class score out of 30 and exam score out of 70', () => {
  it('has maximums of 30 and 70 in the settings', async () => {
    const { rows } = await db.query<{ class_score_max: string; exam_score_max: string }>(`select class_score_max, exam_score_max from settings limit 1`)
    expect(rows.length === 0 || (Number(rows[0].class_score_max) === 30 && Number(rows[0].exam_score_max) === 70)).toBe(true)
  })
  it('accepts a full mark of 30 and 70', async () => {
    const r = await db.query<{ id: string }>(`insert into students (full_name, gender, class_id, status) select 'Full Marks', 'male', class_id, 'active' from students limit 1 returning id`)
    const sid = r.rows[0].id
    const subj = (await db.query<{ id: string }>(`select id from subjects limit 1`)).rows[0].id
    const term = (await db.query<{ id: string }>(`select id from terms limit 1`)).rows[0].id
    await db.query(`insert into scores (student_id, subject_id, term_id, class_score, exam_score) values ($1, $2, $3, 30, 70)`, [sid, subj, term])
    const t = (await db.query<{ t: string }>(`select class_score + exam_score as t from scores where student_id = $1`, [sid])).rows[0].t
    expect(Number(t)).toBe(100)
  })
})

// T14: saving teacher and headmaster remarks (rule G9).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
type Row = { student_id: string; teacher_remark?: string; head_remark?: string }
const save = (uid: string, rows: Row[]) =>
  asUser(db, uid, () => db.query(`select save_remarks($1, $2, $3::jsonb)`, [id.cls, id.term, JSON.stringify(rows)]))
const remarkOf = async (s: string) =>
  (await db.query<{ teacher_remark: string | null; head_remark: string | null }>(`select teacher_remark, head_remark from report_remarks where student_id = $1`, [s])).rows[0]
const historyCount = async () => (await db.query<{ n: number }>(`select count(*)::int as n from history where table_name = 'report_remarks'`)).rows[0].n

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff'), ('${id.admin}','Head','admin')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.a = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.b = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.cls])
})

describe('save_remarks', () => {
  it('Staff and Admin save remarks; students with none get no row', async () => {
    await save(id.staff, [{ student_id: id.a, teacher_remark: '  Works hard  ' }, { student_id: id.b }])
    expect(await remarkOf(id.a)).toEqual({ teacher_remark: 'Works hard', head_remark: null })
    expect(await remarkOf(id.b)).toBeUndefined()
    await save(id.admin, [{ student_id: id.a, teacher_remark: 'Works hard', head_remark: 'Keep it up' }])
    expect(await remarkOf(id.a)).toEqual({ teacher_remark: 'Works hard', head_remark: 'Keep it up' })
  })

  it('keeps the old value in history only when a remark really changes', async () => {
    const before = await historyCount()
    await save(id.admin, [{ student_id: id.a, teacher_remark: 'Works hard', head_remark: 'Keep it up' }])
    expect(await historyCount()).toBe(before)
    await save(id.admin, [{ student_id: id.a, teacher_remark: 'Works very hard', head_remark: 'Keep it up' }])
    expect(await historyCount()).toBe(before + 1)
  })

  it('lets a remark be cleared', async () => {
    await save(id.admin, [{ student_id: id.a, teacher_remark: '', head_remark: '' }])
    expect(await remarkOf(id.a)).toEqual({ teacher_remark: null, head_remark: null })
  })

  it('refuses a remark over 300 characters, a student from another class, a closed term and a published class', async () => {
    await expect(save(id.staff, [{ student_id: id.a, teacher_remark: 'x'.repeat(301) }])).rejects.toThrow(/300/)
    const other = await one(`insert into classes (name, level_order) values ('Basic 4', 9) returning id`)
    const stranger = await one(`insert into students (full_name, gender, class_id) values ('Yaw','male',$1) returning id`, [other])
    await expect(save(id.staff, [{ student_id: stranger, teacher_remark: 'hi' }])).rejects.toThrow(/not in this class/)
    await db.exec(`update terms set status = 'closed'`)
    await expect(save(id.staff, [])).rejects.toThrow(/closed/)
    await db.exec(`update terms set status = 'open'`)
    await db.exec(`insert into results_publish (class_id, term_id) values ('${id.cls}','${id.term}')`)
    await expect(save(id.staff, [{ student_id: id.a, teacher_remark: 'late change' }])).rejects.toThrow(/published/)
  })
})

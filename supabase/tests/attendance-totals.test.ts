// T11: the totals function counts only recorded weeks and only weeks where the student has an entry.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id

beforeAll(async () => {
  db = await createTestDb()
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.t1 = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
  id.t2 = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 2','2027-01-11','2027-04-09') returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.a = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.b = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.cls])
  const wk = async (start: string, days: number, term = id.t1) =>
    one(`insert into attendance_weeks (class_id, term_id, week_start, school_days) values ($1,$2,$3,$4) returning id`, [id.cls, term, start, days])
  const w1 = await wk('2026-09-07', 5), w2 = await wk('2026-09-14', 4), w3 = await wk('2027-01-11', 5, id.t2)
  await db.exec(`insert into attendance_entries (week_id, student_id, days_absent) values
    ('${w1}','${id.a}',1), ('${w1}','${id.b}',0), ('${w2}','${id.a}',0), ('${w3}','${id.a}',5)`) // Kofi has no entry in week 2
})

describe('attendance_term_totals', () => {
  it('adds school days and absences per student for the term only', async () => {
    const { rows } = await db.query<{ student_id: string; weeks: string; school_days: string; days_absent: string }>(
      `select * from attendance_term_totals($1)`, [id.t1])
    const a = rows.find((r) => r.student_id === id.a)!
    const b = rows.find((r) => r.student_id === id.b)!
    expect([Number(a.weeks), Number(a.school_days), Number(a.days_absent)]).toEqual([2, 9, 1])
    expect([Number(b.weeks), Number(b.school_days), Number(b.days_absent)]).toEqual([1, 5, 0]) // week 2 not counted for Kofi
  })

  it('does not mix terms', async () => {
    const { rows } = await db.query<{ days_absent: string }>(`select * from attendance_term_totals($1)`, [id.t2])
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].days_absent)).toBe(5)
  })
})

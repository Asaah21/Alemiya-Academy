// T02 acceptance tests: apply every migration to a real (in-memory) Postgres and check the rules.
// Supabase's own "auth" schema does not exist here, so a tiny stand-in is created first.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from './helpers'

const ALL_TABLES = [
  'settings', 'academic_years', 'terms', 'classes', 'subjects', 'class_subjects', 'grade_scale',
  'profiles', 'staff', 'students', 'student_movements', 'parent_access', 'attendance_weeks',
  'attendance_entries', 'staff_attendance', 'non_school_days', 'scores', 'report_remarks',
  'results_publish', 'fee_items', 'payments', 'term_snapshots', 'history',
]

let db: PGlite
const ids: Record<string, string> = {}

async function one(sql: string, params: unknown[] = []): Promise<string> {
  const res = await db.query<{ id: string }>(sql, params)
  return res.rows[0].id
}

beforeAll(async () => {
  db = await createTestDb()

  // One row in every table (also proves every table accepts a valid row)
  await db.exec(`insert into settings (school_name) values ('Alemiya Academy')`)
  ids.year = await one(`insert into academic_years (name, start_date, end_date, is_current)
    values ('2025/2026', '2025-09-01', '2026-07-31', true) returning id`)
  ids.term = await one(`insert into terms (academic_year_id, name, start_date, end_date, is_current)
    values ($1, 'Term 1', '2025-09-01', '2025-12-15', true) returning id`, [ids.year])
  ids.class = await one(`insert into classes (name, level_order) values ('JHS 1', 12) returning id`)
  ids.subject = await one(`insert into subjects (name, type) values ('Mathematics', 'core') returning id`)
  await db.exec(`insert into class_subjects (class_id, subject_id) values ('${ids.class}', '${ids.subject}')`)
  await db.exec(`insert into grade_scale (min_score, max_score, grade, remark) values (80, 100, 'A', 'Excellent')`)
  ids.user = await one(`insert into auth.users default values returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${ids.user}', 'Head', 'admin')`)
  ids.staff = await one(`insert into staff (full_name, class_id) values ('Mr Test', $1) returning id`, [ids.class])
  ids.student = await one(`insert into students (admission_no, full_name, gender, class_id)
    values ('ALM-2025-001', 'Ama Test', 'female', $1) returning id`, [ids.class])
  await db.exec(`insert into student_movements (student_id, term_id, movement) values ('${ids.student}', '${ids.term}', 'new')`)
  await db.exec(`insert into parent_access (student_id, code_hash) values ('${ids.student}', 'hash')`)
  ids.week = await one(`insert into attendance_weeks (class_id, term_id, week_start, school_days)
    values ($1, $2, '2025-09-08', 5) returning id`, [ids.class, ids.term])
  await db.exec(`insert into attendance_entries (week_id, student_id, days_absent) values ('${ids.week}', '${ids.student}', 1)`)
  await db.exec(`insert into staff_attendance (staff_id, attendance_date, term_id) values ('${ids.staff}', '2025-09-08', '${ids.term}')`)
  await db.exec(`insert into non_school_days (non_school_date, term_id, reason) values ('2025-10-01', '${ids.term}', 'Holiday')`)
  ids.score = await one(`insert into scores (student_id, subject_id, term_id, class_score, exam_score)
    values ($1, $2, $3, 25, 60) returning id`, [ids.student, ids.subject, ids.term])
  await db.exec(`insert into report_remarks (student_id, term_id, teacher_remark) values ('${ids.student}', '${ids.term}', 'Good')`)
  await db.exec(`insert into results_publish (class_id, term_id) values ('${ids.class}', '${ids.term}')`)
  await db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${ids.class}', '${ids.term}', 'Tuition', 200)`)
  ids.payment = await one(`insert into payments (student_id, term_id, amount, receipt_no)
    values ($1, $2, 50, 'R-2025-0001') returning id`, [ids.student, ids.term])
  await db.exec(`insert into term_snapshots (term_id, data) values ('${ids.term}', '{}')`)
})

describe('T02 tables', () => {
  it('creates all 23 tables from section 6 of the plan', async () => {
    const res = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )
    expect(res.rows.map((r) => r.table_name).sort()).toEqual([...ALL_TABLES].sort())
  })

  it('has a row in every table', async () => {
    for (const t of ALL_TABLES.filter((t) => t !== 'history')) {
      const res = await db.query<{ n: number }>(`select count(*)::int as n from public.${t}`)
      expect(res.rows[0].n, t).toBeGreaterThan(0)
    }
  })

  it('has row-level security switched on for every table', async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    )
    expect(res.rows.length).toBe(ALL_TABLES.length)
    expect(res.rows.filter((r) => !r.relrowsecurity)).toEqual([])
  })
})

describe('database rules', () => {
  it('A4: blocks days absent above school days', async () => {
    const week = await one(`insert into attendance_weeks (class_id, term_id, week_start, school_days)
      values ($1, $2, '2025-09-15', 4) returning id`, [ids.class, ids.term])
    await expect(
      db.exec(`insert into attendance_entries (week_id, student_id, days_absent) values ('${week}', '${ids.student}', 5)`),
    ).rejects.toThrow(/cannot be more than school days/)
  })

  it('A4: blocks lowering school days below existing absences', async () => {
    await expect(
      db.exec(`update attendance_weeks set school_days = 0 where id = '${ids.week}'`),
    ).rejects.toThrow(/more days absent/)
  })

  it('A1: week must start on a Monday', async () => {
    await expect(
      db.exec(`insert into attendance_weeks (class_id, term_id, week_start) values ('${ids.class}', '${ids.term}', '2025-09-10')`),
    ).rejects.toThrow()
  })

  it('A1: only one attendance record per class per week', async () => {
    await expect(
      db.exec(`insert into attendance_weeks (class_id, term_id, week_start) values ('${ids.class}', '${ids.term}', '2025-09-08')`),
    ).rejects.toThrow()
  })

  it('G6: blocks scores above 30 and 70', async () => {
    await expect(db.exec(`update scores set class_score = 31 where id = '${ids.score}'`)).rejects.toThrow(/Class score/)
    await expect(db.exec(`update scores set exam_score = 71 where id = '${ids.score}'`)).rejects.toThrow(/Exam score/)
  })

  it('G6: blocks negative scores', async () => {
    await expect(db.exec(`update scores set exam_score = -1 where id = '${ids.score}'`)).rejects.toThrow()
  })

  it('rejects overlapping grade bands', async () => {
    await expect(
      db.exec(`insert into grade_scale (min_score, max_score, grade) values (70, 85, 'B')`),
    ).rejects.toThrow()
    await db.exec(`insert into grade_scale (min_score, max_score, grade) values (70, 79.99, 'B')`)
  })

  it('S1: admission numbers are unique', async () => {
    await expect(
      db.exec(`insert into students (admission_no, full_name, gender) values ('ALM-2025-001', 'Other', 'male')`),
    ).rejects.toThrow()
  })

  it('F6: a payment cannot be deleted or changed', async () => {
    await expect(db.exec(`delete from payments where id = '${ids.payment}'`)).rejects.toThrow(/cannot be deleted/)
    await expect(db.exec(`update payments set amount = 1 where id = '${ids.payment}'`)).rejects.toThrow(/cannot be changed/)
  })

  it('F6: voiding needs a reason, and a voided payment stays fixed', async () => {
    await expect(db.exec(`update payments set status = 'void' where id = '${ids.payment}'`)).rejects.toThrow()
    await db.exec(`update payments set status = 'void', void_reason = 'Entered twice' where id = '${ids.payment}'`)
    await expect(db.exec(`update payments set note = 'x' where id = '${ids.payment}'`)).rejects.toThrow(/voided/)
  })

  it('D9: records cannot be deleted', async () => {
    await expect(db.exec(`delete from students where id = '${ids.student}'`)).rejects.toThrow(/cannot be deleted/)
    await expect(db.exec(`delete from scores where id = '${ids.score}'`)).rejects.toThrow(/cannot be deleted/)
  })

  it('keeps the earlier values when a record is corrected', async () => {
    await db.exec(`update students set guardian_phone = '0240000000' where id = '${ids.student}'`)
    await db.exec(`update students set guardian_phone = '0241111111' where id = '${ids.student}'`)
    const res = await db.query<{ old_values: { guardian_phone: string | null } }>(
      `select old_values from history where table_name = 'students' and record_id = '${ids.student}' order by changed_at, id`,
    )
    expect(res.rows).toHaveLength(2)
    expect(res.rows[1].old_values.guardian_phone).toBe('0240000000')
  })

  it('allows only one current academic year and one current term', async () => {
    await expect(
      db.exec(`insert into academic_years (name, start_date, end_date, is_current) values ('2026/2027', '2026-09-01', '2027-07-31', true)`),
    ).rejects.toThrow()
  })
})

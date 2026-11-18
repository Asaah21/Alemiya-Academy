// T03 acceptance tests: Admin can do everything allowed, Staff is limited, strangers see nothing.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}

async function one(sql: string, params: unknown[] = []): Promise<string> {
  return (await db.query<{ id: string }>(sql, params)).rows[0].id
}
async function user(email: string): Promise<string> {
  return one(`insert into auth.users (email) values ($1) returning id`, [email])
}
async function count(sql: string): Promise<number> {
  return (await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`)).rows[0].n
}

beforeAll(async () => {
  db = await createTestDb()
  id.admin = await user('admin@test')
  id.staff = await user('staff@test')
  id.other = await user('other@test')       // has a login but no profile
  id.inactive = await user('inactive@test')
  id.staff2 = await user('staff2@test')
  await db.exec(`insert into profiles (auth_user_id, full_name, role, email) values
    ('${id.admin}', 'Head', 'admin', 'admin@test'),
    ('${id.staff}', 'Teacher', 'staff', 'staff@test'),
    ('${id.staff2}', 'Teacher Two', 'staff', 'staff2@test')`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role, active) values ('${id.inactive}', 'Left', 'staff', false)`)

  id.year = await one(`insert into academic_years (name, start_date, end_date) values ('2025/2026', '2025-09-01', '2026-07-31') returning id`)
  id.term = await one(`insert into terms (academic_year_id, name, start_date, end_date) values ($1, 'Term 1', '2025-09-01', '2025-12-15') returning id`, [id.year])
  id.class = await one(`insert into classes (name, level_order) values ('JHS 1', 12) returning id`)
  id.subject = await one(`insert into subjects (name, type) values ('Maths', 'core') returning id`)
  id.student = await one(`insert into students (admission_no, full_name, gender, class_id) values ('ALM-1', 'Ama', 'female', $1) returning id`, [id.class])
  id.staffRow = await one(`insert into staff (full_name) values ('Mr Test') returning id`)
  id.score = await one(`insert into scores (student_id, subject_id, term_id, class_score, exam_score) values ($1, $2, $3, 20, 50) returning id`, [id.student, id.subject, id.term])
  id.payment = await one(`insert into payments (student_id, term_id, amount, receipt_no, received_by) values ($1, $2, 10, 'R-1', $3) returning id`, [id.student, id.term, id.staff])
  await db.exec(`insert into staff_attendance (staff_id, attendance_date, term_id) values ('${id.staffRow}', '2025-09-08', '${id.term}')`)
  await db.exec(`insert into parent_access (student_id, code_hash) values ('${id.student}', 'h')`)
})

describe('strangers see nothing', () => {
  it('anonymous visitors cannot read or write', async () => {
    await asUser(db, null, async () => {
      expect(await count(`select 1 from students`)).toBe(0)
      await expect(db.exec(`insert into students (admission_no, full_name, gender) values ('X', 'X', 'male')`)).rejects.toThrow(/row-level security/)
    })
  })

  it('a logged-in user with no profile sees nothing and cannot add', async () => {
    await asUser(db, id.other, async () => {
      expect(await count(`select 1 from students`)).toBe(0)
      expect(await count(`select 1 from payments`)).toBe(0)
      await expect(db.exec(`insert into students (admission_no, full_name, gender) values ('X', 'X', 'male')`)).rejects.toThrow(/row-level security/)
    })
  })

  it('a deactivated user sees nothing', async () => {
    await asUser(db, id.inactive, async () => {
      expect(await count(`select 1 from students`)).toBe(0)
    })
  })
})

describe('Staff role', () => {
  it('can view students, results and fees', async () => {
    await asUser(db, id.staff, async () => {
      expect(await count(`select 1 from students`)).toBe(1)
      expect(await count(`select 1 from scores`)).toBe(1)
      expect(await count(`select 1 from payments`)).toBe(1)
    })
  })

  it('can add a student with status active but not with another status', async () => {
    await asUser(db, id.staff, async () => {
      await db.exec(`insert into students (admission_no, full_name, gender) values ('ALM-2', 'Kofi', 'male')`)
      await expect(
        db.exec(`insert into students (admission_no, full_name, gender, status) values ('ALM-3', 'Yaw', 'male', 'withdrawn')`),
      ).rejects.toThrow(/row-level security/)
    })
  })

  it('cannot edit a saved student record', async () => {
    await asUser(db, id.staff, async () => {
      const res = await db.query(`update students set full_name = 'Changed' where id = '${id.student}' returning id`)
      expect(res.rows).toHaveLength(0)
    })
    expect((await db.query<{ full_name: string }>(`select full_name from students where id = '${id.student}'`)).rows[0].full_name).toBe('Ama')
  })

  it('can record a new admission but not a withdrawal', async () => {
    await asUser(db, id.staff, async () => {
      await db.exec(`insert into student_movements (student_id, term_id, movement) values ('${id.student}', '${id.term}', 'new')`)
      await expect(
        db.exec(`insert into student_movements (student_id, term_id, movement) values ('${id.student}', '${id.term}', 'withdrawn')`),
      ).rejects.toThrow(/row-level security/)
    })
  })

  it('can enter and save again attendance, scores and remarks', async () => {
    await asUser(db, id.staff, async () => {
      const week = await one(`insert into attendance_weeks (class_id, term_id, week_start) values ($1, $2, '2025-09-08') returning id`, [id.class, id.term])
      await db.exec(`insert into attendance_entries (week_id, student_id, days_absent) values ('${week}', '${id.student}', 1)`)
      const upd = await db.query(`update attendance_entries set days_absent = 2 where week_id = '${week}' returning id`)
      expect(upd.rows).toHaveLength(1)
      const s = await db.query(`update scores set exam_score = 55 where id = '${id.score}' returning id`)
      expect(s.rows).toHaveLength(1)
      await db.exec(`insert into report_remarks (student_id, term_id, teacher_remark) values ('${id.student}', '${id.term}', 'Good')`)
    })
  })

  it('can record a payment under their own name only', async () => {
    await asUser(db, id.staff, async () => {
      await db.exec(`insert into payments (student_id, term_id, amount, receipt_no, received_by) values ('${id.student}', '${id.term}', 20, 'R-2', '${id.staff}')`)
      await expect(
        db.exec(`insert into payments (student_id, term_id, amount, receipt_no, received_by) values ('${id.student}', '${id.term}', 20, 'R-3', '${id.staff2}')`),
      ).rejects.toThrow(/row-level security/)
    })
  })

  it('cannot void a payment', async () => {
    await asUser(db, id.staff, async () => {
      const res = await db.query(`update payments set status = 'void', void_reason = 'x' where id = '${id.payment}' returning id`)
      expect(res.rows).toHaveLength(0)
    })
  })

  it('cannot change setup (classes, fee items, settings)', async () => {
    await asUser(db, id.staff, async () => {
      await expect(db.exec(`insert into classes (name, level_order) values ('Primary 1', 6)`)).rejects.toThrow(/row-level security/)
      await expect(db.exec(`insert into fee_items (class_id, term_id, name, amount) values ('${id.class}', '${id.term}', 'X', 1)`)).rejects.toThrow(/row-level security/)
      expect(await count(`select 1 from classes`)).toBe(1)
    })
  })

  it('cannot see staff attendance, parent access codes or history', async () => {
    await asUser(db, id.staff, async () => {
      expect(await count(`select 1 from staff_attendance`)).toBe(0)
      expect(await count(`select 1 from parent_access`)).toBe(0)
      expect(await count(`select 1 from history`)).toBe(0)
    })
  })

  it('can read only their own profile and cannot change any', async () => {
    await asUser(db, id.staff, async () => {
      const res = await db.query<{ email: string }>(`select email from profiles`)
      expect(res.rows.map((r) => r.email)).toEqual(['staff@test'])
      await expect(db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.other}', 'Me', 'admin')`)).rejects.toThrow(/row-level security/)
      const up = await db.query(`update profiles set role = 'admin' where auth_user_id = '${id.staff}' returning id`)
      expect(up.rows).toHaveLength(0)
    })
  })
})

describe('Admin role', () => {
  it('can edit a student, change setup and read everything', async () => {
    await asUser(db, id.admin, async () => {
      const res = await db.query(`update students set full_name = 'Ama Mensah' where id = '${id.student}' returning id`)
      expect(res.rows).toHaveLength(1)
      await db.exec(`insert into classes (name, level_order) values ('Primary 1', 6)`)
      expect(await count(`select 1 from staff_attendance`)).toBe(1)
      expect(await count(`select 1 from parent_access`)).toBe(1)
      expect(await count(`select 1 from profiles`)).toBe(4)
      expect(await count(`select 1 from history`)).toBeGreaterThan(0)
    })
  })

  it('can take staff attendance and record any movement', async () => {
    await asUser(db, id.admin, async () => {
      await db.exec(`insert into staff_attendance (staff_id, attendance_date, term_id, status) values ('${id.staffRow}', '2025-09-09', '${id.term}', 'absent')`)
      await db.exec(`insert into student_movements (student_id, term_id, movement, reason) values ('${id.student}', '${id.term}', 'withdrawn', 'Moved')`)
    })
  })

  it('can void a payment with a reason, but still cannot delete or edit it', async () => {
    await asUser(db, id.admin, async () => {
      const res = await db.query(`update payments set status = 'void', void_reason = 'Entered twice' where id = '${id.payment}' returning id`)
      expect(res.rows).toHaveLength(1)
      // there is no delete rule for anyone, so the database quietly refuses
      const del = await db.query(`delete from payments where id = '${id.payment}' returning id`)
      expect(del.rows).toHaveLength(0)
    })
    expect(await count(`select 1 from payments where id = '${id.payment}'`)).toBe(1)
  })

  it('cannot write profiles from the browser (only the server function can)', async () => {
    await asUser(db, id.admin, async () => {
      await expect(db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.other}', 'Me', 'admin')`)).rejects.toThrow(/row-level security/)
    })
  })
})

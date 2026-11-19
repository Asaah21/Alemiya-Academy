// T10: saving a week of attendance (rules A1 to A5, A8).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const save = (uid: string, week: string, days: number, entries: { student_id: string; days_absent: number }[]) =>
  asUser(db, uid, () => db.query<{ save_attendance_week: string }>(`select save_attendance_week($1, $2, $3, $4::jsonb)`, [id.cls, week, days, JSON.stringify(entries)]))
const absent = async (s: string) =>
  (await db.query<{ days_absent: number }>(`select days_absent from attendance_entries where student_id = $1`, [s])).rows.map((r) => r.days_absent)
const historyCount = async (table: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from history where table_name = $1`, [table])).rows[0].n

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  await db.query(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true)`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.a = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.b = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.cls])
})

describe('save_attendance_week', () => {
  it('Staff save a week; students left out or at 0 are saved as 0 absences', async () => {
    await save(id.staff, '2026-11-09', 5, [{ student_id: id.a, days_absent: 2 }, { student_id: id.b, days_absent: 0 }])
    expect(await absent(id.a)).toEqual([2])
    expect(await absent(id.b)).toEqual([0])
  })

  it('blocks days absent above school days and saves nothing from that call', async () => {
    await expect(save(id.staff, '2026-11-16', 4, [{ student_id: id.b, days_absent: 1 }, { student_id: id.a, days_absent: 5 }])).rejects.toThrow(/cannot be more/i)
    const n = (await db.query<{ n: number }>(`select count(*)::int as n from attendance_weeks where week_start = '2026-11-16'`)).rows[0].n
    expect(n).toBe(0)
  })

  it('saving again corrects the week and keeps only the changed old value in history', async () => {
    const before = await historyCount('attendance_entries')
    await save(id.staff, '2026-11-09', 5, [{ student_id: id.a, days_absent: 3 }, { student_id: id.b, days_absent: 0 }])
    expect(await absent(id.a)).toEqual([3])
    expect(await historyCount('attendance_entries')).toBe(before + 1)
  })

  it('saving the same values again changes and logs nothing', async () => {
    const e = await historyCount('attendance_entries'), w = await historyCount('attendance_weeks')
    await save(id.staff, '2026-11-09', 5, [{ student_id: id.a, days_absent: 3 }, { student_id: id.b, days_absent: 0 }])
    expect(await historyCount('attendance_entries')).toBe(e)
    expect(await historyCount('attendance_weeks')).toBe(w)
  })

  it('lets school days be lowered for a holiday week, unless someone was absent more', async () => {
    await save(id.staff, '2026-11-23', 5, [{ student_id: id.a, days_absent: 1 }])
    await expect(save(id.staff, '2026-11-23', 0, [{ student_id: id.a, days_absent: 0 }])).rejects.toThrow()
    await save(id.staff, '2026-11-23', 3, [{ student_id: id.a, days_absent: 1 }])
    const d = (await db.query<{ school_days: number }>(`select school_days from attendance_weeks where week_start = '2026-11-23'`)).rows[0]
    expect(d.school_days).toBe(3)
  })

  it('refuses a week that is not a Monday, outside any term, or a student from another class', async () => {
    await expect(save(id.staff, '2026-11-10', 5, [])).rejects.toThrow(/Monday/)
    await expect(save(id.staff, '2027-03-01', 5, [])).rejects.toThrow(/not inside any term/)
    const other = await one(`insert into classes (name, level_order) values ('Basic 4', 9) returning id`)
    const stranger = await one(`insert into students (full_name, gender, class_id) values ('Esi','female',$1) returning id`, [other])
    await expect(save(id.staff, '2026-11-30', 5, [{ student_id: stranger, days_absent: 0 }])).rejects.toThrow(/not in this class/)
  })

  it('refuses a closed term', async () => {
    await db.exec(`update terms set status = 'closed'`)
    await expect(save(id.staff, '2026-12-07', 5, [])).rejects.toThrow(/closed/)
    await db.exec(`update terms set status = 'open'`)
  })
})

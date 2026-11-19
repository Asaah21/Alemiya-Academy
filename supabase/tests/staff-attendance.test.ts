// T34: daily staff attendance (rules ST1 to ST5).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const save = (uid: string, date: string, entries: unknown[]) =>
  asUser(db, uid, () => db.query(`select save_staff_attendance($1, $2::jsonb)`, [date, JSON.stringify(entries)]))
const statusOf = async (staff: string, date: string) =>
  (await db.query<{ status: string; note: string | null }>(`select status, note from staff_attendance where staff_id = $1 and attendance_date = $2`, [staff, date])).rows[0]
const historyCount = async () => (await db.query<{ n: number }>(`select count(*)::int as n from history where table_name = 'staff_attendance'`)).rows[0].n

beforeAll(async () => {
  db = await createTestDb()
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.admin}','Head','admin'), ('${id.staff}','Teacher','staff')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('Y','${day(-100)}','${day(100)}',true) returning id`)
  await db.query(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','${day(-60)}','${day(60)}',true)`, [y])
  id.a = await one(`insert into staff (full_name) values ('Mr Owusu') returning id`)
  id.b = await one(`insert into staff (full_name) values ('Mrs Addo') returning id`)
})

describe('save_staff_attendance', () => {
  it('Staff role cannot save or even see staff attendance', async () => {
    await expect(save(id.staff, day(-1), [{ staff_id: id.a, status: 'present' }])).rejects.toThrow()
    const r = await asUser(db, id.staff, () => db.query(`select * from staff_attendance`))
    expect(r.rows).toHaveLength(0)
  })

  it('Admin saves a day with exceptions and notes', async () => {
    await save(id.admin, day(-2), [{ staff_id: id.a, status: 'present' }, { staff_id: id.b, status: 'late', note: ' bus broke down ' }])
    expect(await statusOf(id.a, day(-2))).toEqual({ status: 'present', note: null })
    expect(await statusOf(id.b, day(-2))).toEqual({ status: 'late', note: 'bus broke down' })
  })

  it('saving again corrects only what changed and keeps the old value in history', async () => {
    const before = await historyCount()
    await save(id.admin, day(-2), [{ staff_id: id.a, status: 'present' }, { staff_id: id.b, status: 'absent', note: 'sick' }])
    expect((await statusOf(id.b, day(-2))).status).toBe('absent')
    expect(await historyCount()).toBe(before + 1)
    await save(id.admin, day(-2), [{ staff_id: id.a, status: 'present' }, { staff_id: id.b, status: 'absent', note: 'sick' }])
    expect(await historyCount()).toBe(before + 1)
  })

  it('refuses a future date, an unknown status, and a day outside any term', async () => {
    await expect(save(id.admin, day(1), [])).rejects.toThrow(/future/i)
    await expect(save(id.admin, day(-3), [{ staff_id: id.a, status: 'sleeping' }])).rejects.toThrow(/Unknown/)
    await expect(save(id.admin, day(-90), [])).rejects.toThrow(/not inside any term/)
  })

  it('refuses a closed term', async () => {
    await db.exec(`update terms set status = 'closed'`)
    await expect(save(id.admin, day(-3), [])).rejects.toThrow(/closed/)
    await db.exec(`update terms set status = 'open'`)
  })
})

describe('non-school days', () => {
  const mark = (uid: string, date: string, reason = 'Public holiday') =>
    asUser(db, uid, () => db.query(`select set_non_school_day($1, $2)`, [date, reason]))

  it('Admin marks a holiday; attendance cannot then be saved for it', async () => {
    await mark(id.admin, day(-5))
    await expect(save(id.admin, day(-5), [{ staff_id: id.a, status: 'present' }])).rejects.toThrow(/non-school/)
  })

  it('cannot mark a day that already has attendance', async () => {
    await expect(mark(id.admin, day(-2))).rejects.toThrow(/already saved/)
  })

  it('Staff role cannot mark a non-school day', async () => {
    await expect(mark(id.staff, day(-6))).rejects.toThrow()
    const n = (await db.query<{ n: number }>(`select count(*)::int as n from non_school_days where non_school_date = $1`, [day(-6)])).rows[0].n
    expect(n).toBe(0)
  })
})

describe('staff_attendance_totals (T35)', () => {
  it('counts each status per person, only for saved days, Admin only', async () => {
    await save(id.admin, day(-10), [{ staff_id: id.a, status: 'late' }, { staff_id: id.b, status: 'on_leave' }])
    await save(id.admin, day(-11), [{ staff_id: id.a, status: 'present' }, { staff_id: id.b, status: 'absent' }])
    const term = (await db.query<{ id: string }>(`select id from terms limit 1`)).rows[0].id
    const rows = await asUser(db, id.admin, () => db.query<{ staff_id: string; present: string; late: string; absent: string; on_leave: string }>(`select * from staff_attendance_totals($1)`, [term]))
    const a = rows.rows.find((r) => r.staff_id === id.a)!
    const b = rows.rows.find((r) => r.staff_id === id.b)!
    expect([a.present, a.late, a.absent, a.on_leave].map(Number)).toEqual([2, 1, 0, 0]) // day(-2) present, day(-11) present, day(-10) late
    expect([b.present, b.late, b.absent, b.on_leave].map(Number)).toEqual([0, 0, 2, 1]) // day(-2) absent, day(-11) absent, day(-10) leave
    const none = await asUser(db, id.staff, () => db.query(`select * from staff_attendance_totals($1)`, [term]))
    expect(none.rows).toHaveLength(0)
  })
})

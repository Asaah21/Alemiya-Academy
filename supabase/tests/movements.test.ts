// T09: moving students out and back in keeps status and history in step; Staff cannot do it.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const move = (uid: string, student: string, m: string, date = '2026-11-01', reason: string | null = 'because') =>
  asUser(db, uid, () => db.query(`select record_movement($1, $2, $3, $4)`, [student, m, date, reason]))
const status = async (s: string) => (await db.query<{ status: string }>(`select status from students where id = $1`, [s])).rows[0].status
const movements = async (s: string) =>
  (await db.query<{ movement: string }>(`select movement from student_movements where student_id = $1 order by created_at, movement`, [s])).rows.map((r) => r.movement)

beforeAll(async () => {
  db = await createTestDb()
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.admin}','Head','admin'), ('${id.staff}','Teacher','staff')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  await db.query(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-01','2026-12-15',true)`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.a = await one(`insert into students (full_name, gender, class_id) values ('Ama', 'female', $1) returning id`, [id.cls])
  id.b = await one(`insert into students (full_name, gender, class_id, joined_as) values ('Kofi', 'male', $1, 'transfer_in') returning id`, [id.cls])
  id.c = await one(`insert into students (full_name, gender, class_id) values ('Esi', 'female', $1) returning id`, [id.cls])
})

describe('admissions', () => {
  it('records new admissions and transfers in', async () => {
    expect(await movements(id.a)).toEqual(['new'])
    expect(await movements(id.b)).toEqual(['transfer_in'])
  })
})

describe('record_movement', () => {
  it('Staff cannot change a status, and nothing is recorded', async () => {
    await expect(move(id.staff, id.a, 'withdrawn')).rejects.toThrow()
    expect(await status(id.a)).toBe('active')
    expect(await movements(id.a)).toEqual(['new'])
  })

  it('Admin withdraws a student with a reason; status and history agree', async () => {
    await move(id.admin, id.a, 'withdrawn', '2026-11-01', 'Family moved')
    expect(await status(id.a)).toBe('withdrawn')
    const m = (await db.query<{ movement: string; reason: string; from_class_id: string }>(
      `select movement, reason, from_class_id from student_movements where student_id = $1 and movement = 'withdrawn'`, [id.a])).rows[0]
    expect(m).toEqual({ movement: 'withdrawn', reason: 'Family moved', from_class_id: id.cls })
  })

  it('needs a reason, except for graduation', async () => {
    await expect(move(id.admin, id.b, 'transfer_out', '2026-11-01', '  ')).rejects.toThrow(/reason/i)
    await move(id.admin, id.b, 'graduated', '2026-11-01', null)
    expect(await status(id.b)).toBe('graduated')
  })

  it('refuses future dates, moving out twice, and an unknown movement', async () => {
    await expect(move(id.admin, id.c, 'transfer_out', '2999-01-01')).rejects.toThrow(/future/i)
    await expect(move(id.admin, id.a, 'withdrawn')).rejects.toThrow(/active/i)
    await expect(move(id.admin, id.c, 'promoted')).rejects.toThrow()
    expect(await status(id.c)).toBe('active')
  })

  it('brings a student back as a transfer in, and keeps the old values in history', async () => {
    await move(id.admin, id.a, 'transfer_in', '2026-11-10', 'Returned to the village')
    expect(await status(id.a)).toBe('active')
    expect(await movements(id.a)).toEqual(expect.arrayContaining(['new', 'withdrawn', 'transfer_in']))
    const h = await db.query(`select 1 from history where table_name = 'students' and record_id = $1`, [id.a])
    expect(h.rows.length).toBe(2)
  })
})

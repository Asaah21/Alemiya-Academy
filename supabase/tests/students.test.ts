// T07: admission numbers, new-admission record, and who may add or edit students.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id

beforeAll(async () => {
  db = await createTestDb()
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.admin}','Head','admin'), ('${id.staff}','Teacher','staff')`)
  id.year = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-01','2026-12-15',true) returning id`, [id.year])
  id.class = await one(`insert into classes (name, level_order) values ('Basic 1', 6) returning id`)
})

const add = (uid: string, name: string, admitted = '2026-09-07') =>
  asUser(db, uid, async () =>
    (await db.query<{ admission_no: string; id: string }>(
      `insert into students (full_name, gender, class_id, admitted_on) values ($1, 'female', $2, $3) returning id, admission_no`,
      [name, id.class, admitted],
    )).rows[0],
  )

describe('admission numbers', () => {
  it('counts up within the year, by Staff or Admin', async () => {
    expect((await add(id.staff, 'Ama')).admission_no).toBe('ALM-2026-001')
    expect((await add(id.admin, 'Kofi')).admission_no).toBe('ALM-2026-002')
    expect((await add(id.staff, 'Esi')).admission_no).toBe('ALM-2026-003')
  })

  it('starts again at 001 in a new year', async () => {
    expect((await add(id.admin, 'Yaw', '2027-01-10')).admission_no).toBe('ALM-2027-001')
  })

  it('keeps a number the Admin types in, and carries on after it', async () => {
    await db.exec(`insert into students (admission_no, full_name, gender) values ('ALM-2026-010', 'Old Student', 'male')`)
    expect((await add(id.admin, 'Abena')).admission_no).toBe('ALM-2026-011')
  })
})

describe('new admission record', () => {
  it('writes a "new" movement in the current term', async () => {
    const s = await add(id.staff, 'Kwame')
    const m = await db.query<{ movement: string; term_id: string }>(`select movement, term_id from student_movements where student_id = $1`, [s.id])
    expect(m.rows).toEqual([{ movement: 'new', term_id: id.term }])
  })
})

describe('who may edit', () => {
  it('Staff cannot edit a student; Admin can, and the old values go to history', async () => {
    const s = await add(id.staff, 'Efua')
    const staffEdit = await asUser(db, id.staff, () => db.query(`update students set full_name = 'Changed' where id = $1 returning id`, [s.id]))
    expect(staffEdit.rows).toHaveLength(0)
    await asUser(db, id.admin, () => db.query(`update students set full_name = 'Efua Mensah' where id = $1`, [s.id]))
    const h = await db.query<{ old_values: { full_name: string } }>(`select old_values from history where record_id = $1`, [s.id])
    expect(h.rows[0].old_values.full_name).toBe('Efua')
  })
})

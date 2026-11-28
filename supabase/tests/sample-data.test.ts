import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTestDb } from './helpers'

const sql = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8')
const count = async (db: Awaited<ReturnType<typeof createTestDb>>, q: string) =>
  Number(((await db.query(q)).rows[0] as { n: string | number }).n)

describe('sample data scripts', () => {
  it('adds sample data on an empty system, only once, and removes it again', async () => {
    const db = await createTestDb()
    await db.exec(sql('sample_data.sql'))
    expect(await count(db, "select count(*) n from students where admission_no like 'TEST-%'")).toBe(78)
    expect(await count(db, 'select count(*) n from staff')).toBe(6)
    expect(await count(db, 'select count(*) n from payments')).toBeGreaterThan(30)
    expect(await count(db, 'select count(*) n from scores')).toBeGreaterThan(200)
    expect(await count(db, 'select count(*) n from fee_items')).toBe(13)
    expect(await count(db, "select count(*) n from fee_items f join classes c on c.id = f.class_id where c.name in ('Nursery 1','Nursery 2','KG 1','KG 2') and f.amount = 345")).toBe(4)
    expect(await count(db, 'select count(*) n from fee_items where amount = 355')).toBe(9)
    expect(await count(db, 'select count(*) n from notices')).toBe(2)
    // second run does nothing
    await db.exec(sql('sample_data.sql'))
    expect(await count(db, 'select count(*) n from students')).toBe(78)
    // totals still work
    const bal = await db.query("select * from fee_balances((select id from terms where is_current limit 1))")
    expect(bal.rows.length).toBe(78)
    await db.exec(sql('remove_sample_data.sql'))
    for (const t of ['students', 'staff', 'payments', 'scores', 'attendance_entries', 'staff_attendance', 'report_remarks', 'notices', 'student_movements']) {
      expect(await count(db, `select count(*) n from ${t}`)).toBe(0)
    }
    expect(await count(db, 'select count(*) n from attendance_weeks')).toBe(0)
  })

  it('keeps real students when the sample data is removed', async () => {
    const db = await createTestDb()
    await db.exec(`insert into classes (name, level_order) values ('Basic 1', 6)`)
    await db.exec(`insert into students (full_name, gender, class_id) select 'Real Student', 'male', id from classes limit 1`)
    await db.exec(sql('sample_data.sql'))
    await db.exec(sql('remove_sample_data.sql'))
    expect(await count(db, 'select count(*) n from students')).toBe(1)
  })

  it('set_fees.sql gives 345 to the nursery and KG classes and 355 to the rest, and can be run again', async () => {
    const db = await createTestDb()
    await db.exec(sql('sample_data.sql'))
    await db.exec(`insert into fee_items (class_id, term_id, name, amount) select id, (select id from terms where is_current), 'PTA dues', 20 from classes where name = 'JHS 1'`)
    await db.exec(`insert into classes (name, level_order) values ('Creche', 0)`)
    await db.exec(sql('set_fees.sql'))
    await db.exec(sql('set_fees.sql'))
    expect(await count(db, "select count(*) n from classes where name = 'Creche'")).toBe(0)
    expect(await count(db, 'select count(*) n from fee_items')).toBe(13)
    expect(await count(db, "select count(*) n from fee_items f join classes c on c.id = f.class_id where c.name in ('Nursery 1','Nursery 2','KG 1','KG 2') and f.amount = 345")).toBe(4)
    expect(await count(db, 'select count(*) n from fee_items where amount = 355')).toBe(9)
  })
})

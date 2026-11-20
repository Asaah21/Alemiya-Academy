// T24: enrolment turnover (rules S3, S4).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
type T = Record<string, number | string>
const turnover = async (term: string, cls: string) =>
  Object.fromEntries((await db.query<T>(`select * from enrolment_turnover($1) where class_id = $2`, [term, cls])).rows.map((r) => [r.gender, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' || v === null ? v : Number(v)]))]))
const mv = (student: string, movement: string, on: string, from: string | null, to: string | null, term: string) =>
  db.exec(`insert into student_movements (student_id, term_id, movement, moved_on, reason, from_class_id, to_class_id) values ('${student}','${term}','${movement}','${on}','r',${from ? `'${from}'` : 'null'},${to ? `'${to}'` : 'null'})`)

beforeAll(async () => {
  db = await createTestDb()
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-01-01','2026-12-31',true) returning id`)
  id.t1 = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-01-05','2026-04-02',true) returning id`, [y])
  id.t2 = await one(`insert into terms (academic_year_id,name,start_date,end_date) values ($1,'Term 2','2026-04-27','2026-07-31') returning id`, [y])
  id.a = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.b = await one(`insert into classes (name, level_order) values ('Basic 4', 9) returning id`)
  // students are inserted as the superuser; the new-admission trigger logs their joins, so clear them and write our own history
  const mk = async (name: string, g: string, cls: string, status = 'active') => one(`insert into students (full_name, gender, class_id, status) values ($1,$2,$3,$4) returning id`, [name, g, cls, status])
  id.ama = await mk('Ama', 'female', id.a, 'withdrawn')
  id.kofi = await mk('Kofi', 'male', id.a, 'transferred_out')
  id.esi = await mk('Esi', 'female', id.b)
  id.yaw = await mk('Yaw', 'male', id.a)
  await db.exec(`delete from student_movements`).catch(() => {})
})

describe('enrolment_turnover', () => {
  beforeAll(async () => {
    await db.exec(`alter table student_movements disable trigger all`)
    await db.exec(`delete from student_movements`)
    await mv(id.ama, 'new', '2025-09-01', null, id.a, id.t1)          // before Term 1: part of the opening roll
    await mv(id.kofi, 'new', '2026-02-01', null, id.a, id.t1)
    await mv(id.esi, 'transfer_in', '2026-02-10', null, id.a, id.t1)
    await mv(id.ama, 'withdrawn', '2026-03-01', id.a, null, id.t1)
    await mv(id.kofi, 'transfer_out', '2026-04-10', id.a, null, id.t1) // between terms: belongs to Term 1
    await mv(id.yaw, 'new', '2026-05-01', null, id.a, id.t2)
    await mv(id.esi, 'promoted', '2026-05-10', id.a, id.b, id.t2)
  })

  it('counts Term 1 per gender', async () => {
    const r = await turnover(id.t1, id.a)
    expect(r.female).toMatchObject({ opening: 1, new_admissions: 0, transfers_in: 1, withdrawn: 1, transfers_out: 0, closing: 1 })
    expect(r.male).toMatchObject({ opening: 0, new_admissions: 1, transfers_out: 1, closing: 0 })
  })

  it('opens Term 2 with what Term 1 closed with, and counts promotions', async () => {
    const a = await turnover(id.t2, id.a)
    expect(a.female).toMatchObject({ opening: 1, promoted_out: 1, closing: 0 })
    expect(a.male).toMatchObject({ opening: 0, new_admissions: 1, closing: 1 })
    const b = await turnover(id.t2, id.b)
    expect(b.female).toMatchObject({ opening: 0, promoted_in: 1, closing: 1 })
  })

  it('closing = opening + joins - leaves in every row', async () => {
    for (const term of [id.t1, id.t2]) {
      const rows = (await db.query<T>(`select * from enrolment_turnover($1)`, [term])).rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' ? v : Number(v)])))
      for (const r of rows) {
        expect(r.closing).toBe((r.opening as number) + (r.new_admissions as number) + (r.transfers_in as number) + (r.promoted_in as number) - (r.transfers_out as number) - (r.withdrawn as number) - (r.graduated as number) - (r.promoted_out as number))
      }
    }
  })

  it('lists every class and gender, even with no movements', async () => {
    const rows = (await db.query(`select * from enrolment_turnover($1)`, [id.t1])).rows
    expect(rows).toHaveLength(4) // 2 classes x 2 genders
  })

  it('lists the students behind the numbers with date and reason', async () => {
    const rows = (await db.query<{ full_name: string; movement: string; moved_on: Date; reason: string }>(`select * from turnover_students($1)`, [id.t1])).rows
    expect(rows.map((r) => [r.full_name, r.movement])).toEqual([['Kofi', 'new'], ['Esi', 'transfer_in'], ['Ama', 'withdrawn'], ['Kofi', 'transfer_out']])
    expect(rows[0].reason).toBe('r')
  })
})

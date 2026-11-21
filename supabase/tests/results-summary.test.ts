// T25: per-student results totals for the summary report.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const summary = async () => Object.fromEntries((await db.query<{ student_id: string; subjects_expected: string; subjects_scored: string; overall: string }>(`select * from results_summary($1)`, [id.term])).rows.map((r) => [r.student_id, [Number(r.subjects_expected), Number(r.subjects_scored), Number(r.overall)]]))

beforeAll(async () => {
  db = await createTestDb()
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-01-01','2026-12-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-01-05','2026-04-02',true) returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.nursery = await one(`insert into classes (name, level_order, scored) values ('Creche', 1, false) returning id`)
  id.eng = await one(`insert into subjects (name, type) values ('English','core') returning id`)
  id.mat = await one(`insert into subjects (name, type) values ('Maths','core') returning id`)
  id.other = await one(`insert into subjects (name, type) values ('Art','core') returning id`)
  await db.exec(`insert into class_subjects (class_id, subject_id) values ('${id.cls}','${id.eng}'), ('${id.cls}','${id.mat}')`)
  const mk = (n: string, cls: string, status = 'active') => one(`insert into students (full_name, gender, class_id, status) values ($1,'male',$2,$3) returning id`, [n, cls, status])
  id.full = await mk('Ama', id.cls)
  id.part = await mk('Kofi', id.cls)
  id.absent = await mk('Yaw', id.cls)
  id.left = await mk('Esi', id.cls, 'withdrawn')
  id.baby = await mk('Baby', id.nursery)
  const sc = (s: string, sub: string, c: string | null, e: string | null, a = false) => db.exec(`insert into scores (student_id, subject_id, term_id, class_score, exam_score, is_absent) values ('${s}','${sub}','${id.term}',${c},${e},${a})`)
  await sc(id.full, id.eng, '25', '60'); await sc(id.full, id.mat, '20', '50')
  await sc(id.part, id.eng, '10', '30'); await sc(id.part, id.mat, '15', 'null') // half-entered maths
  await sc(id.absent, id.eng, '20', '40'); await sc(id.absent, id.mat, 'null', 'null', true)
  await sc(id.full, id.other, '30', '70') // a subject that is not set for the class must not count
})

describe('results_summary', () => {
  it('counts subjects expected, scored (Absent counts as done) and the overall total', async () => {
    const s = await summary()
    expect(s[id.full]).toEqual([2, 2, 155])
    expect(s[id.part]).toEqual([2, 1, 55]) // 15 entered for maths counts in the total but maths is not complete
    expect(s[id.absent]).toEqual([2, 2, 60])
  })
  it('leaves out students who left and classes without scores', async () => {
    const s = await summary()
    expect(Object.keys(s)).toHaveLength(3)
    expect(s[id.left]).toBeUndefined()
    expect(s[id.baby]).toBeUndefined()
  })
})

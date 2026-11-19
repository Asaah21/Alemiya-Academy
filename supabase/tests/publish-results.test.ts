// T16: publishing and unpublishing results (rule C3, G7).
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const publish = (uid: string, cls = id.cls) => asUser(db, uid, () => db.query(`select publish_results($1, $2)`, [cls, id.term]))
const unpublish = (uid: string, cls = id.cls) => asUser(db, uid, () => db.query(`select unpublish_results($1, $2)`, [cls, id.term]))
const published = async () => (await db.query(`select 1 from results_publish`)).rows.length

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Teacher','staff'), ('${id.admin}','Head','admin')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
  id.cls = await one(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)
  id.sub = await one(`insert into subjects (name, type) values ('English','core') returning id`)
  await db.exec(`insert into class_subjects (class_id, subject_id) values ('${id.cls}','${id.sub}')`)
  id.a = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [id.cls])
  id.b = await one(`insert into students (full_name, gender, class_id) values ('Kofi','male',$1) returning id`, [id.cls])
})

describe('publish_results', () => {
  it('refuses Staff', async () => {
    await expect(publish(id.staff)).rejects.toThrow(/Only the Admin/)
  })

  it('refuses while a score is missing, then publishes once complete', async () => {
    await db.exec(`insert into scores (student_id, subject_id, term_id, class_score, exam_score) values ('${id.a}','${id.sub}','${id.term}',20,50)`)
    await expect(publish(id.admin)).rejects.toThrow(/1 score\(s\) are still missing/)
    await db.exec(`insert into scores (student_id, subject_id, term_id, is_absent) values ('${id.b}','${id.sub}','${id.term}',true)`)
    await publish(id.admin)
    expect(await published()).toBe(1)
  })

  it('refuses to publish twice', async () => {
    await expect(publish(id.admin)).rejects.toThrow(/already published/)
  })

  it('blocks score changes while published, and allows them after unpublishing', async () => {
    const save = () => asUser(db, id.staff, () => db.query(`select save_scores($1,$2,$3,$4::jsonb)`, [id.cls, id.sub, id.term, JSON.stringify([{ student_id: id.a, class_score: 21, exam_score: 50 }])]))
    await expect(save()).rejects.toThrow(/published/)
    await expect(unpublish(id.staff)).rejects.toThrow(/Only the Admin/)
    await unpublish(id.admin)
    expect(await published()).toBe(0)
    await save()
  })

  it('keeps a history record of the unpublish and refuses to unpublish what is not published', async () => {
    const n = (await db.query<{ n: number }>(`select count(*)::int as n from history where table_name = 'results_publish'`)).rows[0].n
    expect(n).toBe(1)
    await expect(unpublish(id.admin)).rejects.toThrow(/not published/)
  })

  it('refuses a scored class with no subjects; publishes a remarks-only class, but not an empty one', async () => {
    const ns = await one(`insert into classes (name, level_order) values ('Basic 9', 20) returning id`)
    await db.exec(`insert into students (full_name, gender, class_id) values ('Yaw','male','${ns}')`)
    await expect(publish(id.admin, ns)).rejects.toThrow(/No subjects/)
    const cr = await one(`insert into classes (name, level_order, scored) values ('Creche', 1, false) returning id`)
    await expect(publish(id.admin, cr)).rejects.toThrow(/no active students/)
    await db.exec(`insert into students (full_name, gender, class_id) values ('Esi','female','${cr}')`)
    await publish(id.admin, cr)
    expect(await published()).toBe(1)
  })
})

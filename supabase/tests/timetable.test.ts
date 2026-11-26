// T31: timetable records. Admin uploads, Admin and Staff read, nothing is deleted.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const run = <T>(uid: string | null, sql: string, p: unknown[] = []) => asUser(db, uid, async () => (await db.query<T>(sql, p)).rows)
const add = (uid: string, path: string, term = id.term) =>
  run<{ id: string }>(uid, `insert into timetables (term_id, file_path, file_name, content_type, size_bytes) values ($1, $2, 'tt.pdf', 'application/pdf', 5000) returning id`, [term, path])

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  id.parent = await one(`insert into auth.users (email) values ('p@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Mrs Teacher','staff'), ('${id.admin}','Head Master','admin')`)
  const y = await one(`insert into academic_years (name,start_date,end_date,is_current) values ('2026/2027','2026-09-01','2027-07-31',true) returning id`)
  id.term = await one(`insert into terms (academic_year_id,name,start_date,end_date,is_current) values ($1,'Term 1','2026-09-07','2026-12-18',true) returning id`, [y])
})

describe('timetables', () => {
  it('lets only the Admin add one, and records who uploaded it', async () => {
    await expect(add(id.staff, 'x/1-a.pdf')).rejects.toThrow()
    await add(id.admin, 'x/2-a.pdf')
    const rows = await run<{ uploaded_by_name: string }>(id.admin, `select uploaded_by_name from timetables`)
    expect(rows[0].uploaded_by_name).toBe('Head Master')
  })

  it('lets Staff read it but not change it', async () => {
    expect(await run(id.staff, `select id from timetables`)).toHaveLength(1)
    expect(await run(id.staff, `update timetables set archived = true returning id`)).toEqual([])
  })

  it('hides the old file when a new one replaces it, and keeps the history', async () => {
    await add(id.admin, 'x/3-b.pdf')
    await run(id.admin, `update timetables set archived = true where file_path = 'x/2-a.pdf'`)
    const live = await run<{ file_path: string }>(id.staff, `select file_path from timetables where not archived and term_id = $1`, [id.term])
    expect(live.map((r) => r.file_path)).toEqual(['x/3-b.pdf'])
    expect((await db.query(`select 1 from history where table_name = 'timetables'`)).rows).toHaveLength(1)
  })

  it('rejects an oversize file record and a duplicate path', async () => {
    await expect(run(id.admin, `insert into timetables (term_id, file_path, file_name, size_bytes) values ($1, 'x/big.pdf', 'big.pdf', 99999999)`, [id.term])).rejects.toThrow()
    await expect(add(id.admin, 'x/3-b.pdf')).rejects.toThrow()
  })

  it('cannot be deleted and is invisible to parents and strangers', async () => {
    await expect(db.exec(`delete from timetables`)).rejects.toThrow(/cannot be deleted/)
    expect(await run(id.parent, `select * from timetables`)).toEqual([])
  })
})

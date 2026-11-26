// T30: notices. Staff and Admin post, only Admin hides, parents see only notices meant for them.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

let db: PGlite
const id: Record<string, string> = {}
const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id
const run = <T>(uid: string | null, sql: string, p: unknown[] = []) => asUser(db, uid, async () => (await db.query<T>(sql, p)).rows)
const post = (uid: string, title: string, audience = 'staff') => run<{ id: string }>(uid, `insert into notices (title, body, audience) values ($1, 'Body text', $2) returning id`, [title, audience])

beforeAll(async () => {
  db = await createTestDb()
  id.staff = await one(`insert into auth.users (email) values ('s@t') returning id`)
  id.admin = await one(`insert into auth.users (email) values ('a@t') returning id`)
  id.parent = await one(`insert into auth.users (email) values ('p@t') returning id`)
  id.stranger = await one(`insert into auth.users (email) values ('x@t') returning id`)
  await db.exec(`insert into profiles (auth_user_id, full_name, role) values ('${id.staff}','Mrs Teacher','staff'), ('${id.admin}','Head Master','admin')`)
  const c = await one(`insert into classes (name, level_order) values ('Basic 1', 1) returning id`)
  const s = await one(`insert into students (full_name, gender, class_id) values ('Ama','female',$1) returning id`, [c])
  await db.exec(`insert into parent_access (student_id, code_hash, auth_user_id) values ('${s}','h','${id.parent}')`)
})

describe('notices', () => {
  it('lets Staff and Admin post and records the poster name', async () => {
    await post(id.staff, 'Staff meeting Friday')
    await post(id.admin, 'School closes early', 'staff_and_parents')
    await post(id.admin, 'Staff only memo')
    const rows = await run<{ title: string; posted_by_name: string }>(id.staff, `select title, posted_by_name from notices order by created_at, title`)
    expect(rows).toHaveLength(3)
    expect(rows.find((r) => r.title === 'Staff meeting Friday')?.posted_by_name).toBe('Mrs Teacher')
  })

  it('rejects an empty title, an empty message and an unknown audience', async () => {
    await expect(post(id.staff, '   ')).rejects.toThrow()
    await expect(run(id.staff, `insert into notices (title, body) values ('T', '  ')`)).rejects.toThrow()
    await expect(post(id.staff, 'T', 'everyone')).rejects.toThrow()
  })

  it('lets only the Admin hide a notice, and keeps the old values', async () => {
    const nid = (await db.query<{ id: string }>(`select id from notices where title = 'Staff only memo'`)).rows[0].id
    expect(await run(id.staff, `update notices set archived = true where id = $1 returning id`, [nid])).toEqual([])
    expect(await run(id.admin, `update notices set archived = true where id = $1 returning id`, [nid])).toHaveLength(1)
    const h = await db.query(`select 1 from history where table_name = 'notices' and record_id = $1`, [nid])
    expect(h.rows).toHaveLength(1)
  })

  it('cannot be deleted', async () => {
    await expect(db.exec(`delete from notices`)).rejects.toThrow(/cannot be deleted/)
  })

  it('shows a parent only visible notices meant for parents', async () => {
    const rows = await run<{ title: string }>(id.parent, `select * from parent_notices()`)
    expect(rows.map((r) => r.title)).toEqual(['School closes early'])
  })

  it('gives parents no direct table access and refuses strangers', async () => {
    expect(await run(id.parent, `select * from notices`)).toEqual([])
    await expect(run(id.parent, `insert into notices (title, body) values ('x','y')`)).rejects.toThrow()
    await expect(run(id.stranger, `select * from parent_notices()`)).rejects.toThrow(/Not available/)
    expect(await run(id.stranger, `select * from notices`)).toEqual([])
  })
})

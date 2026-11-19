// T33: only the Admin can add or change the staff list; both roles can read it; changes are logged.
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
  id.row = await one(`insert into staff (full_name, phone) values ('Mr Owusu', '0241234567') returning id`)
})

describe('staff list access', () => {
  it('Staff can read but not add or change', async () => {
    const rows = await asUser(db, id.staff, () => db.query(`select * from staff`))
    expect(rows.rows).toHaveLength(1)
    await expect(asUser(db, id.staff, () => db.query(`insert into staff (full_name) values ('Sneaky')`))).rejects.toThrow()
    const upd = await asUser(db, id.staff, () => db.query(`update staff set status = 'inactive' where id = $1 returning id`, [id.row]))
    expect(upd.rows).toHaveLength(0)
  })

  it('Admin adds, edits and deactivates; the old values go to history', async () => {
    await asUser(db, id.admin, () => db.query(`insert into staff (full_name) values ('Mrs Addo')`))
    await asUser(db, id.admin, () => db.query(`update staff set status = 'inactive' where id = $1`, [id.row]))
    const s = await db.query<{ status: string }>(`select status from staff where id = $1`, [id.row])
    expect(s.rows[0].status).toBe('inactive')
    const h = await db.query(`select 1 from history where table_name = 'staff' and record_id = $1`, [id.row])
    expect(h.rows).toHaveLength(1)
  })

  it('rejects a status other than active or inactive', async () => {
    await expect(asUser(db, id.admin, () => db.query(`update staff set status = 'fired' where id = $1`, [id.row]))).rejects.toThrow()
  })
})

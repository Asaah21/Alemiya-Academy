import { describe, expect, it } from 'vitest'
import { asUser, createTestDb } from './helpers'

describe('function access', () => {
  it('visitors who are not logged in cannot run any function in the public schema', async () => {
    const db = await createTestDb()
    const res = await db.query(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')`)
    expect(res.rows).toEqual([])
  })

  it('a visitor who is not logged in cannot call the parent or payment functions', async () => {
    const db = await createTestDb()
    await expect(asUser(db, null, () => db.query('select * from parent_me()'))).rejects.toThrow(/permission denied/)
    await expect(asUser(db, null, () => db.query('select * from parent_fees()'))).rejects.toThrow(/permission denied/)
  })
})

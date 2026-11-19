// T08: a bulk insert of students gets distinct admission numbers and is all-or-nothing.
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from './helpers'

let db: PGlite
let classId: string

beforeAll(async () => {
  db = await createTestDb()
  classId = (await db.query<{ id: string }>(`insert into classes (name, level_order) values ('Basic 3', 8) returning id`)).rows[0].id
})

describe('bulk student insert', () => {
  it('numbers 50 students ALM-year-001 to 050 in one statement', async () => {
    const values = Array.from({ length: 50 }, (_, i) => `('Pupil ${i + 1}', 'female', '${classId}')`).join(',')
    await db.exec(`insert into students (full_name, gender, class_id) values ${values}`)
    const { rows } = await db.query<{ n: number; d: number }>(`select count(*)::int as n, count(distinct admission_no)::int as d from students`)
    expect(rows[0]).toEqual({ n: 50, d: 50 })
    const year = new Date().getFullYear()
    const first = (await db.query<{ admission_no: string }>(`select admission_no from students order by admission_no limit 1`)).rows[0]
    expect(first.admission_no).toBe(`ALM-${year}-001`)
  })

  it('saves none of the rows when one is bad', async () => {
    await expect(
      db.exec(`insert into students (full_name, gender, class_id) values ('Good One', 'female', '${classId}'), ('Bad One', 'robot', '${classId}')`),
    ).rejects.toThrow()
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from students where full_name in ('Good One', 'Bad One')`)
    expect(rows[0].n).toBe(0)
  })
})

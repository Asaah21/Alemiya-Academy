import { describe, expect, it } from 'vitest'
import { backupFileName, fetchAll, JSON_TABLES, PAGE, sheetFrom } from './backup'

describe('backup', () => {
  it('reads every page until a short one', async () => {
    const calls: number[] = []
    const rows = await fetchAll(async (from) => {
      calls.push(from)
      const n = from === 0 ? PAGE : from === PAGE ? PAGE : 5
      return { data: Array.from({ length: n }, (_, i) => ({ i: from + i })), error: null }
    })
    expect(rows).toHaveLength(2 * PAGE + 5)
    expect(calls).toEqual([0, PAGE, 2 * PAGE])
  })
  it('stops with the error message', async () => {
    await expect(fetchAll(async () => ({ data: null, error: { message: 'denied' } }))).rejects.toThrow('denied')
  })
  it('builds a sheet with a header, blanks for nulls and text for objects', () => {
    const s = sheetFrom([{ a: 1, b: null }, { a: 2, c: { x: 1 } }])
    expect(s[0].map((c) => c.value)).toEqual(['a', 'b', 'c'])
    expect(s[1].map((c) => c.value)).toEqual([1, undefined, undefined])
    expect(s[2].map((c) => c.value)).toEqual([2, undefined, '{"x":1}'])
  })
  it('handles an empty table', () => {
    expect(sheetFrom([])).toEqual([[{ value: '(no records)' }]])
  })
  it('never includes parent access codes', () => {
    expect(JSON_TABLES).not.toContain('parent_access' as never)
    expect(backupFileName('xlsx', '2026-11-21')).toBe('Alemiya-Academy-backup-2026-11-21.xlsx')
  })
})

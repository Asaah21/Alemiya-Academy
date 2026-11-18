import { describe, expect, it } from 'vitest'
import { validateTerm, validateYear } from './terms'

const year = { start_date: '2026-09-01', end_date: '2027-07-31' }

describe('validateYear', () => {
  it('accepts 2026/2027', () => {
    expect(validateYear({ name: '2026/2027', ...year }).ok).toBe(true)
  })
  it('rejects bad names and dates', () => {
    expect(validateYear({ name: '2026', ...year }).ok).toBe(false)
    expect(validateYear({ name: '2026/2028', ...year }).ok).toBe(false)
    expect(validateYear({ name: '2026/2027', start_date: '2027-01-01', end_date: '2026-01-01' }).ok).toBe(false)
    expect(validateYear({ name: '2026/2027', start_date: '', end_date: '2027-01-01' }).ok).toBe(false)
  })
})

describe('validateTerm', () => {
  const t1 = { id: 'a', name: 'Term 1', start_date: '2026-09-01', end_date: '2026-12-15' }
  it('accepts a term inside the year', () => {
    expect(validateTerm({ name: 'Term 2', start_date: '2027-01-10', end_date: '2027-04-10' }, year, [t1]).ok).toBe(true)
  })
  it('rejects a term outside the year, overlapping, or repeated', () => {
    expect(validateTerm({ name: 'Term 2', start_date: '2026-08-01', end_date: '2026-10-01' }, year, []).ok).toBe(false)
    expect(validateTerm({ name: 'Term 2', start_date: '2026-12-01', end_date: '2027-03-01' }, year, [t1]).ok).toBe(false)
    expect(validateTerm({ name: 'Term 1', start_date: '2027-01-10', end_date: '2027-03-01' }, year, [t1]).ok).toBe(false)
  })
  it('lets a term be edited without clashing with itself', () => {
    expect(validateTerm({ ...t1, end_date: '2026-12-20' }, year, [t1]).ok).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { addDays, checkWeek, isMonday, mondayOf, weekLabel } from './weeks'

describe('mondayOf', () => {
  it('finds the Monday from any day of the week', () => {
    expect(mondayOf('2026-11-19')).toBe('2026-11-16') // Thursday
    expect(mondayOf('2026-11-16')).toBe('2026-11-16') // Monday
    expect(mondayOf('2026-11-22')).toBe('2026-11-16') // Sunday belongs to the week before
  })
  it('crosses month and year ends', () => {
    expect(mondayOf('2027-01-01')).toBe('2026-12-28')
    expect(addDays('2026-11-30', 7)).toBe('2026-12-07')
    expect(addDays('2026-11-09', -7)).toBe('2026-11-02')
  })
  it('knows what a Monday is', () => {
    expect(isMonday('2026-11-16')).toBe(true)
    expect(isMonday('2026-11-17')).toBe(false)
  })
})

describe('weekLabel', () => {
  it('shows Monday to Friday', () => {
    expect(weekLabel('2026-11-16')).toMatch(/Mon.*16.*Nov.*to.*Fri.*20.*Nov.*2026/)
  })
})

describe('checkWeek (rule A4)', () => {
  it('accepts absences up to the school days', () => {
    expect(checkWeek(5, { a: 0, b: 5 }).ok).toBe(true)
  })
  it('rejects more absences than school days and lists the students', () => {
    const r = checkWeek(4, { a: 2, b: 5 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.studentIds).toEqual(['b'])
  })
  it('rejects bad school days', () => {
    expect(checkWeek(8, {}).ok).toBe(false)
    expect(checkWeek(-1, {}).ok).toBe(false)
  })
})

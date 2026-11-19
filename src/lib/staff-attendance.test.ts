import { describe, expect, it } from 'vitest'
import { daysNotRecorded, isWeekend, schoolDaysUpTo } from './staff-attendance'

const term = { start_date: '2026-09-07', end_date: '2026-12-18' } // starts on a Monday

describe('schoolDaysUpTo', () => {
  it('lists Monday to Friday only, up to today', () => {
    expect(schoolDaysUpTo(term, '2026-09-10', [])).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'])
    expect(schoolDaysUpTo(term, '2026-09-14', [])).toHaveLength(6) // 5 + Monday; the weekend is skipped
  })
  it('leaves out holidays', () => {
    expect(schoolDaysUpTo(term, '2026-09-09', ['2026-09-08'])).toEqual(['2026-09-07', '2026-09-09'])
  })
  it('stops at the end of the term', () => {
    const all = schoolDaysUpTo(term, '2027-06-01', [])
    expect(all[all.length - 1]).toBe('2026-12-18')
    expect(all).toHaveLength(75)
  })
  it('is empty before the term starts', () => {
    expect(schoolDaysUpTo(term, '2026-09-01', [])).toEqual([])
  })
})

describe('daysNotRecorded', () => {
  it('lists school days with no saved entry', () => {
    const due = schoolDaysUpTo(term, '2026-09-10', ['2026-09-08'])
    expect(daysNotRecorded(due, ['2026-09-07'])).toEqual(['2026-09-09', '2026-09-10'])
  })
})

describe('isWeekend', () => {
  it('knows Saturday and Sunday', () => {
    expect(isWeekend('2026-11-21')).toBe(true)
    expect(isWeekend('2026-11-22')).toBe(true)
    expect(isWeekend('2026-11-23')).toBe(false)
  })
})

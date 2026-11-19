import { describe, expect, it } from 'vitest'
import { classRate, rateOf, schoolRate, studentRate, weeksDue, weeksNotRecorded, type Totals } from './attendance'

// Two classes, two weeks recorded of 5 school days. Hand count in the comments.
const rows: Totals[] = [
  { class_id: 'A', student_id: 's1', weeks: 2, school_days: 10, days_absent: 0 }, // 10/10
  { class_id: 'A', student_id: 's2', weeks: 2, school_days: 10, days_absent: 3 }, // 7/10
  { class_id: 'B', student_id: 's3', weeks: 1, school_days: 5, days_absent: 5 },  // 0/5 (joined later, one week only)
]

describe('rates', () => {
  it('per student', () => {
    expect(studentRate(rows, 's1').rate).toBe(100)
    expect(studentRate(rows, 's2').rate).toBe(70)
    expect(studentRate(rows, 's3').rate).toBe(0)
  })
  it('per class: total present / total school days', () => {
    expect(classRate(rows, 'A')).toEqual({ schoolDays: 20, daysPresent: 17, rate: 85 })
    expect(classRate(rows, 'B').rate).toBe(0)
  })
  it('for the school', () => {
    expect(schoolRate(rows)).toEqual({ schoolDays: 25, daysPresent: 17, rate: 68 })
  })
  it('is blank, not zero, when nothing is recorded', () => {
    expect(classRate(rows, 'C').rate).toBeNull()
    expect(rateOf(0, 0).rate).toBeNull()
  })
  it('rounds to one decimal place', () => {
    expect(rateOf(15, 1).rate).toBe(93.3)
  })
})

describe('weeks not recorded', () => {
  const term = { start_date: '2026-09-07', end_date: '2026-12-18' }
  it('lists the weeks whose Friday has come, up to the term end', () => {
    const due = weeksDue(term, '2026-09-25')
    expect(due).toEqual(['2026-09-07', '2026-09-14', '2026-09-21'])
  })
  it('does not count a week still in progress', () => {
    expect(weeksDue(term, '2026-09-24')).toEqual(['2026-09-07', '2026-09-14'])
  })
  it('stops at the end of term', () => {
    const all = weeksDue(term, '2027-02-01')
    expect(all[all.length - 1]).toBe('2026-12-14')
    expect(all).toHaveLength(15)
  })
  it('starts from the week of the term start even if it opens mid-week', () => {
    expect(weeksDue({ start_date: '2026-09-09', end_date: '2026-12-18' }, '2026-09-14')[0]).toBe('2026-09-07')
  })
  it('returns the weeks with no saved entry, in order', () => {
    const due = weeksDue(term, '2026-10-02')
    expect(weeksNotRecorded(due, ['2026-09-07', '2026-09-21'])).toEqual(['2026-09-14', '2026-09-28'])
  })
})

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

import { summariseStaff, summaryTable } from './staff-attendance'

describe('summariseStaff (rules ST5, ST6)', () => {
  const people = [
    { id: 'a', full_name: 'Mr Owusu' }, { id: 'b', full_name: 'Mrs Addo' }, { id: 'c', full_name: 'Nobody Recorded' },
  ]
  // Hand count, 20 recorded days for Mr Owusu: 14 present on time, 3 late, 2 absent, 1 on leave
  const counts = [
    { staff_id: 'a', present: 14, late: 3, absent: 2, on_leave: 1 },
    { staff_id: 'b', present: 0, late: 0, absent: 0, on_leave: 4 },
  ]
  const rows = summariseStaff(counts, people)

  it('counts late as present and also shows it separately', () => {
    const a = rows.find((r) => r.staff_id === 'a')!
    expect(a.present).toBe(17)
    expect(a.late).toBe(3)
    expect(a.absent).toBe(2)
    expect(a.onLeave).toBe(1)
    expect(a.daysRecorded).toBe(20)
  })
  it('leaves on-leave days out of the percentage', () => {
    expect(rows.find((r) => r.staff_id === 'a')!.rate).toBe(89.5) // 17 / (17 + 2)
  })
  it('has no percentage when only leave was recorded, and skips people with nothing recorded', () => {
    expect(rows.find((r) => r.staff_id === 'b')!.rate).toBeNull()
    expect(rows.find((r) => r.staff_id === 'c')).toBeUndefined()
  })
  it('sorts by name and gives table rows for export', () => {
    expect(rows.map((r) => r.name)).toEqual(['Mr Owusu', 'Mrs Addo'].sort())
    expect(summaryTable(rows)[0]).toEqual(['Mr Owusu', 20, 17, 3, 2, 1, 89.5])
  })
})

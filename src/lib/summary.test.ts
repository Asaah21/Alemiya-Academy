import { describe, expect, it } from 'vitest'
import type { Totals } from './attendance'
import type { BalanceRow } from './balances'
import { ATTENDANCE_HEADINGS, allowedIds, attendanceSummary, feesSummary, resultsSummary, sheetRows, type ResultRow, type StudentInfo } from './summary'

const classes = [{ id: 'a', name: 'Basic 3' }, { id: 'b', name: 'Basic 4' }]
const students: StudentInfo[] = [
  { id: 's1', class_id: 'a', gender: 'female' }, { id: 's2', class_id: 'a', gender: 'male' },
  { id: 's3', class_id: 'b', gender: 'male' }, { id: 's4', class_id: 'b', gender: 'female', status: 'withdrawn' },
]
const all = { classId: '', gender: 'all' as const }

describe('filters', () => {
  it('lets through active students by class and gender', () => {
    expect([...allowedIds(students, all)]).toEqual(['s1', 's2', 's3'])
    expect([...allowedIds(students, { classId: 'a', gender: 'male' })]).toEqual(['s2'])
  })
})

describe('attendanceSummary', () => {
  const totals: Totals[] = [
    { class_id: 'a', student_id: 's1', weeks: 2, school_days: 10, days_absent: 1 },
    { class_id: 'a', student_id: 's2', weeks: 2, school_days: 10, days_absent: 3 },
    { class_id: 'b', student_id: 's3', weeks: 2, school_days: 10, days_absent: 0 },
    { class_id: 'b', student_id: 's4', weeks: 2, school_days: 10, days_absent: 10 }, // withdrawn: not counted
  ]
  it('works out days and rate per class and for the school', () => {
    const t = attendanceSummary(totals, students, classes, all)
    expect(t.rows).toEqual([['Basic 3', 2, 20, 16, 4, 80], ['Basic 4', 1, 10, 10, 0, 100]])
    expect(t.total).toEqual(['School', 3, 30, 26, 4, 86.7])
  })
  it('narrows by gender and class', () => {
    expect(attendanceSummary(totals, students, classes, { classId: '', gender: 'female' }).rows).toEqual([['Basic 3', 1, 10, 9, 1, 90]])
    expect(attendanceSummary(totals, students, classes, { classId: 'b', gender: 'all' }).total).toEqual(['School', 1, 10, 10, 0, 100])
  })
  it('shows a blank rate and no rows when nothing is recorded', () => {
    const t = attendanceSummary([], students, classes, all)
    expect(t.rows).toEqual([])
    expect(t.total[5]).toBe('')
  })
})

describe('feesSummary', () => {
  const row = (id: string, cls: string, owed: number, paid: number, arrears = 0): BalanceRow => ({ student_id: id, admission_no: id, full_name: id, class_id: cls, owed, paid, balance: owed - paid, arrears })
  const balances = [row('s1', 'a', 300, 100), row('s2', 'a', 300, 300, 50), row('s3', 'b', 400, 500), row('s4', 'b', 400, 0)]
  it('adds fees, collections, arrears and who still owes', () => {
    const t = feesSummary(balances, students, classes, all)
    expect(t.rows[0]).toEqual(['Basic 3', 2, 600, 400, 200, 50, 250, 2, 66.7])
    expect(t.rows[1]).toEqual(['Basic 4', 1, 400, 500, 0, 0, 0, 0, 100]) // overpaying does not push collection above 100
    expect(t.total).toEqual(['School', 3, 1000, 900, 200, 50, 250, 2, 90])
  })
  it('follows the gender filter', () => {
    expect(feesSummary(balances, students, classes, { classId: '', gender: 'male' }).total.slice(0, 4)).toEqual(['School', 2, 700, 800])
  })
})

describe('resultsSummary', () => {
  const r = (id: string, cls: string, exp: number, scored: number, overall: number): ResultRow => ({ student_id: id, class_id: cls, subjects_expected: exp, subjects_scored: scored, overall })
  const results = [r('s1', 'a', 2, 2, 160), r('s2', 'a', 2, 1, 55), r('s3', 'b', 4, 4, 240)]
  it('averages only complete results and counts the incomplete ones', () => {
    const t = resultsSummary(results, students, classes, all)
    expect(t.rows).toEqual([['Basic 3', 2, 1, 1, 80, 80, 80], ['Basic 4', 1, 1, 0, 60, 60, 60]])
    expect(t.total).toEqual(['School', 3, 2, 1, 70, 80, 60])
  })
  it('leaves the average blank when nothing is complete', () => {
    expect(resultsSummary([r('s2', 'a', 2, 1, 55)], students, classes, all).total).toEqual(['School', 1, 0, 1, '', '', ''])
  })
})

describe('sheetRows', () => {
  it('is exactly what the screen shows: headings, rows, total', () => {
    const t = attendanceSummary([{ class_id: 'a', student_id: 's1', weeks: 1, school_days: 5, days_absent: 0 }], students, classes, all)
    expect(sheetRows(t)).toEqual([ATTENDANCE_HEADINGS, ['Basic 3', 1, 5, 5, 0, 100], ['School', 1, 5, 5, 0, 100]])
  })
})

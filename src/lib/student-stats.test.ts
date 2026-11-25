import { describe, expect, it } from 'vitest'
import { studentStats } from './student-stats'

describe('studentStats', () => {
  const classes = [{ id: 'a', name: 'Basic 1' }, { id: 'b', name: 'Basic 2' }]
  const students = [
    { class_id: 'a', gender: 'male' }, { class_id: 'a', gender: 'female' }, { class_id: 'a', gender: 'female' },
    { class_id: 'b', gender: 'male' },
  ]
  it('counts totals, boys, girls and per class', () => {
    const s = studentStats(students, classes, [])
    expect([s.total, s.boys, s.girls]).toEqual([4, 2, 2])
    expect(s.classes.map((c) => [c.name, c.total, c.boys, c.girls])).toEqual([['Basic 1', 3, 1, 2], ['Basic 2', 1, 1, 0]])
  })
  it('shows no attendance rate until a week is recorded', () => {
    expect(studentStats(students, classes, []).attendance.rate).toBeNull()
  })
  it('works out attendance per class and for the school', () => {
    const totals = [
      { class_id: 'a', student_id: '1', weeks: 1, school_days: 5, days_absent: 1 },
      { class_id: 'b', student_id: '2', weeks: 1, school_days: 5, days_absent: 0 },
    ]
    const s = studentStats(students, classes, totals)
    expect(s.classes[0].attendance.rate).toBe(80)
    expect(s.classes[1].attendance.rate).toBe(100)
    expect(s.attendance.rate).toBe(90)
  })
})

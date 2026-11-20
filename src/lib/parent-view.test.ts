import { describe, expect, it } from 'vitest'
import { cardFromParentReport, positionFrom, type ParentReport } from './parent-view'

const base: ParentReport = {
  school: { name: 'Alemiya Academy', location: 'Alemiya', district: null, region: null, circuit: null, logo_url: null, next_term_opening_date: '2027-01-11', class_score_max: '30.00', exam_score_max: '70.00' },
  student: { id: 's1', full_name: 'Ama', admission_no: 'ALM-2026-001' },
  class_name: 'Basic 3', term_name: 'Term 1', year_name: '2026/2027', scored: true,
  scale: [{ min_score: '80', max_score: '100', grade: 'A', remark: 'Excellent' }, { min_score: '0', max_score: '79.99', grade: 'F', remark: 'Fail' }],
  subjects: [{ id: 'eng', name: 'English' }, { id: 'mat', name: 'Maths' }],
  scores: [
    { student_id: 's1', subject_id: 'eng', class_score: '25.00', exam_score: '60.00', is_absent: false },
    { student_id: 's1', subject_id: 'mat', class_score: '20.00', exam_score: '50.00', is_absent: false },
  ],
  remark: { teacher_remark: 'Good', head_remark: null },
  attendance: { school_days: '50', days_absent: '4' },
  class_totals: ['155.00', '155.00', '40.00'], class_size: 3,
}

describe('positionFrom', () => {
  it('shares a place on a tie and skips the next one', () => {
    expect(positionFrom(155, [155, 155, 40])).toBe(1)
    expect(positionFrom(40, [155, 155, 40])).toBe(3)
    expect(positionFrom(100, [155, 155, 100, 40])).toBe(3)
  })
})

describe('cardFromParentReport', () => {
  it('builds the card with totals, grades, remarks and attendance', () => {
    const c = cardFromParentReport(base)
    expect(c.studentName).toBe('Ama')
    expect(c.subjects.map((s) => [s.name, s.total, s.grade])).toEqual([['English', 85, 'A'], ['Maths', 70, 'F']])
    expect(c.overall).toBe(155)
    expect(c.average).toBe(77.5)
    expect(c.position).toBe(1)
    expect(c.classSize).toBe(3)
    expect(c.attendance).toEqual({ present: 46, schoolDays: 50 })
    expect(c.teacherRemark).toBe('Good')
    expect(c.school.classMax).toBe(30)
  })

  it('gives no position when the class totals are incomplete', () => {
    expect(cardFromParentReport({ ...base, class_totals: ['155', '40'] }).position).toBeNull()
  })

  it('handles a remarks-only class', () => {
    const c = cardFromParentReport({ ...base, scored: false, subjects: [], scores: [], scale: [], class_totals: [] })
    expect(c.scored).toBe(false)
    expect(c.position).toBeNull()
    expect(c.subjects).toEqual([])
  })

  it('handles no remarks and no attendance', () => {
    const c = cardFromParentReport({ ...base, remark: null, attendance: null })
    expect(c.teacherRemark).toBe('')
    expect(c.attendance).toBeNull()
  })
})

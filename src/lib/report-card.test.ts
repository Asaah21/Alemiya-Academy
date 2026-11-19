import { describe, expect, it } from 'vitest'
import { STARTER_SCALE } from './grades'
import { buildClassCards, ordinal, type ClassCardsInput } from './report-card'

const school = { name: 'Alemiya Academy', location: '', district: '', region: '', circuit: '', logoUrl: null, nextTermOpening: '2027-01-11', classMax: 30, examMax: 70 }
const base: ClassCardsInput = {
  school, className: 'Basic 3', termName: 'Term 1', yearName: '2026/2027', scored: true, scale: STARTER_SCALE,
  students: [{ id: 's1', full_name: 'Ama', admission_no: 'ALM-2026-001' }, { id: 's2', full_name: 'Kofi', admission_no: 'ALM-2026-002' }],
  subjects: [{ id: 'm', name: 'Maths' }, { id: 'e', name: 'English' }],
  scores: [
    { student_id: 's1', subject_id: 'm', class_score: 28, exam_score: 62, is_absent: false },
    { student_id: 's1', subject_id: 'e', class_score: 20, exam_score: 50, is_absent: false },
    { student_id: 's2', subject_id: 'm', class_score: 15, exam_score: 40, is_absent: false },
    { student_id: 's2', subject_id: 'e', class_score: null, exam_score: null, is_absent: true },
  ],
  remarks: [{ student_id: 's1', teacher_remark: 'Excellent', head_remark: null }],
  attendance: [{ student_id: 's1', school_days: 50, days_absent: 3 }],
}

describe('buildClassCards', () => {
  const r = buildClassCards(base)
  const ama = r.cards[0]
  const kofi = r.cards[1]

  it('is ready when every student has every subject (Absent counts)', () => {
    expect(r.ready).toBe(true)
    expect(r.missing).toEqual([])
  })
  it('fills in subjects, totals, grades and remarks from the scale', () => {
    expect(ama.subjects[0]).toMatchObject({ name: 'Maths', classScore: 28, examScore: 62, total: 90, grade: 'A', remark: 'Excellent' })
    expect(kofi.subjects[1]).toMatchObject({ name: 'English', absent: true, total: 0, grade: 'F' })
  })
  it('has overall, average and position out of the class size', () => {
    expect(ama).toMatchObject({ overall: 160, average: 80, position: 1, classSize: 2 })
    expect(kofi).toMatchObject({ overall: 55, average: 27.5, position: 2 })
  })
  it('works out attendance and carries the remarks', () => {
    expect(ama.attendance).toEqual({ present: 47, schoolDays: 50 })
    expect(kofi.attendance).toBeNull()
    expect(ama.teacherRemark).toBe('Excellent')
    expect(kofi.teacherRemark).toBe('')
  })
  it('shows grades only when a scale exists', () => {
    expect(ama.showGrades).toBe(true)
    expect(buildClassCards({ ...base, scale: [] }).cards[0].showGrades).toBe(false)
  })
})

describe('not ready, rule G7', () => {
  it('holds the cards back and lists what is missing', () => {
    const r = buildClassCards({ ...base, scores: base.scores.slice(0, 3) })
    expect(r.ready).toBe(false)
    expect(r.missing).toEqual([{ studentId: 's2', name: 'Kofi', subject: 'English', what: 'both scores' }])
  })
})

describe('remarks-only class, rule G8', () => {
  it('needs no scores and shows no subjects or positions', () => {
    const r = buildClassCards({ ...base, scored: false, scores: [] })
    expect(r.ready).toBe(true)
    expect(r.cards[0].subjects).toEqual([])
    expect(r.cards[0].position).toBeNull()
    expect(r.cards[0].teacherRemark).toBe('Excellent')
  })
})

describe('ordinal', () => {
  it('writes 1st, 2nd, 3rd, 4th, 11th, 12th, 21st, 112th', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '112th'])
  })
})

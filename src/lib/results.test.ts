import { describe, expect, it } from 'vitest'
import { STARTER_SCALE } from './grades'
import { checkScore, gradeFor, isComplete, parseScore, subjectTotal } from './results'

describe('parseScore', () => {
  it('reads numbers, blanks and commas', () => {
    expect(parseScore('24')).toEqual({ value: 24 })
    expect(parseScore(' 24,5 ')).toEqual({ value: 24.5 })
    expect(parseScore('')).toEqual({ value: null })
  })
  it('rejects letters, negatives and too many decimals', () => {
    expect('error' in parseScore('abc')).toBe(true)
    expect('error' in parseScore('-3')).toBe(true)
    expect('error' in parseScore('1.234')).toBe(true)
  })
})

describe('checkScore (rule G6)', () => {
  const e = (classText: string, examText: string, absent = false) => ({ classText, examText, absent })
  it('accepts scores up to the maximums', () => {
    expect(checkScore(e('30', '70'), 30, 70).error).toBeNull()
  })
  it('blocks scores above the maximums', () => {
    expect(checkScore(e('31', '10'), 30, 70).error).toMatch(/Class score cannot be more than 30/)
    expect(checkScore(e('10', '70.5'), 30, 70).error).toMatch(/Exam score cannot be more than 70/)
  })
  it('ignores whatever was typed for an absent student', () => {
    expect(checkScore(e('99', 'xx', true), 30, 70)).toEqual({ classScore: null, examScore: null, error: null })
  })
  it('follows the maximums from settings', () => {
    expect(checkScore(e('35', '55'), 40, 60).error).toBeNull()
  })
})

describe('subjectTotal (rule G2)', () => {
  it('adds the two scores', () => expect(subjectTotal(24, 51.5, false)).toBe(75.5))
  it('is blank until something is entered', () => expect(subjectTotal(null, null, false)).toBeNull())
  it('counts absent as 0', () => expect(subjectTotal(null, null, true)).toBe(0))
  it('does not drift on decimals', () => expect(subjectTotal(0.1, 0.2, false)).toBe(0.3))
})

describe('isComplete', () => {
  it('needs both scores, or an Absent mark', () => {
    expect(isComplete(10, 20, false)).toBe(true)
    expect(isComplete(10, null, false)).toBe(false)
    expect(isComplete(null, null, true)).toBe(true)
  })
})

describe('gradeFor (rule G3)', () => {
  it('finds the band', () => {
    expect(gradeFor(80, STARTER_SCALE)?.grade).toBe('A')
    expect(gradeFor(79, STARTER_SCALE)?.grade).toBe('B')
    expect(gradeFor(0, STARTER_SCALE)?.grade).toBe('F')
    expect(gradeFor(100, STARTER_SCALE)?.grade).toBe('A')
  })
  it('puts a decimal total such as 79.5 in the band below, not in a gap', () => {
    expect(gradeFor(79.5, STARTER_SCALE)?.grade).toBe('B')
  })
  it('gives nothing when there is no total or no scale', () => {
    expect(gradeFor(null, STARTER_SCALE)).toBeNull()
    expect(gradeFor(50, [])).toBeNull()
  })
})

import { computeClassResults, rankWithTies, type ScoreRow } from './results'

describe('rankWithTies (rule G5)', () => {
  it('shares positions and skips the next: 1, 2, 2, 4', () => {
    expect(rankWithTies([90, 80, 80, 70])).toEqual([1, 2, 2, 4])
  })
  it('works whatever the order of the input', () => {
    expect(rankWithTies([70, 80, 90, 80])).toEqual([4, 2, 1, 2])
  })
  it('puts everyone first when all are equal', () => {
    expect(rankWithTies([50, 50, 50])).toEqual([1, 1, 1])
  })
  it('treats totals that differ only by rounding noise as equal', () => {
    expect(rankWithTies([0.1 + 0.2, 0.3])).toEqual([1, 1])
  })
})

describe('computeClassResults (rules G4, G5, G7)', () => {
  const students = [{ id: 's1', full_name: 'Ama' }, { id: 's2', full_name: 'Kofi' }, { id: 's3', full_name: 'Esi' }, { id: 's4', full_name: 'Yaw' }]
  const subjects = [{ id: 'm', name: 'Maths' }, { id: 'e', name: 'English' }]
  const sc = (student_id: string, subject_id: string, class_score: number | null, exam_score: number | null, is_absent = false): ScoreRow =>
    ({ student_id, subject_id, class_score, exam_score, is_absent })

  // totals: Ama 90+90=180 (1st), Kofi 80+70=150, Esi 75+75=150, Yaw 60+50=110
  const full: ScoreRow[] = [
    sc('s1', 'm', 30, 60), sc('s1', 'e', 30, 60),
    sc('s2', 'm', 25, 55), sc('s2', 'e', 20, 50),
    sc('s3', 'm', 25, 50), sc('s3', 'e', 25, 50),
    sc('s4', 'm', 20, 40), sc('s4', 'e', 10, 40),
  ]

  it('gives overall total, average and tied positions 1, 2, 2, 4', () => {
    const r = computeClassResults(students, subjects, full)
    expect(r.complete).toBe(true)
    expect(r.rows.map((x) => x.overall)).toEqual([180, 150, 150, 110])
    expect(r.rows.map((x) => x.average)).toEqual([90, 75, 75, 55])
    expect(r.rows.map((x) => x.position)).toEqual([1, 2, 2, 4])
  })

  it('counts an Absent subject as 0 and still completes the class', () => {
    const rows = full.map((s) => (s.student_id === 's4' && s.subject_id === 'e' ? sc('s4', 'e', null, null, true) : s))
    const r = computeClassResults(students, subjects, rows)
    expect(r.complete).toBe(true)
    expect(r.rows[3].overall).toBe(60)
    expect(r.rows[3].subjectTotals.e).toBe(0)
  })

  it('gives no positions while a score is missing, and lists exactly what is missing', () => {
    const rows = full.filter((s) => !(s.student_id === 's2' && s.subject_id === 'm')).map((s) => (s.student_id === 's3' && s.subject_id === 'e' ? sc('s3', 'e', 25, null) : s))
    const r = computeClassResults(students, subjects, rows)
    expect(r.complete).toBe(false)
    expect(r.rows.every((x) => x.position === null)).toBe(true)
    expect(r.missing).toEqual([
      { studentId: 's2', name: 'Kofi', subject: 'Maths', what: 'both scores' },
      { studentId: 's3', name: 'Esi', subject: 'English', what: 'exam score' },
    ])
    expect(r.rows[1].average).toBeNull() // Kofi has an incomplete subject
    expect(r.rows[0].average).toBe(90)
  })

  it('is not complete for an empty class or a class with no subjects', () => {
    expect(computeClassResults([], subjects, []).complete).toBe(false)
    expect(computeClassResults(students, [], []).complete).toBe(false)
  })
})

describe('single score out of 100', () => {
  it('checks one mark against the maximum', async () => {
    const { checkSingleScore } = await import('./results')
    expect(checkSingleScore('85', false, 100)).toEqual({ score: 85, error: null })
    expect(checkSingleScore('', false, 100)).toEqual({ score: null, error: null })
    expect(checkSingleScore('101', false, 100).error).toMatch(/more than 100/)
    expect(checkSingleScore('abc', false, 100).error).toBeTruthy()
    expect(checkSingleScore('50', true, 100)).toEqual({ score: null, error: null })
  })
  it('stores one mark as exam score with class score 0, and reads older rows as class + exam', async () => {
    const { markToColumns, savedMark } = await import('./results')
    expect(markToColumns(85)).toEqual({ class_score: 0, exam_score: 85 })
    expect(markToColumns(null)).toEqual({ class_score: null, exam_score: null })
    expect(savedMark(0, 85)).toBe(85)
    expect(savedMark(24, 51.5)).toBe(75.5)
    expect(savedMark(null, null)).toBeNull()
  })
})

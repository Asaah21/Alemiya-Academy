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

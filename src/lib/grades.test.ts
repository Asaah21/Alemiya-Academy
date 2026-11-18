import { describe, expect, it } from 'vitest'
import { gaps, STANDARD_CLASSES, STARTER_SCALE, validateGrade } from './grades'

const a = { id: '1', min_score: 80, max_score: 100, grade: 'A', remark: '' }
const b = { id: '2', min_score: 70, max_score: 79, grade: 'B', remark: '' }

describe('validateGrade', () => {
  it('accepts a range that touches nothing', () => {
    expect(validateGrade({ min_score: 60, max_score: 69, grade: 'C', remark: '' }, [a, b]).ok).toBe(true)
  })
  it('rejects overlapping ranges, including shared end points', () => {
    expect(validateGrade({ min_score: 75, max_score: 85, grade: 'X', remark: '' }, [a, b]).ok).toBe(false)
    expect(validateGrade({ min_score: 60, max_score: 70, grade: 'X', remark: '' }, [a, b]).ok).toBe(false)
  })
  it('rejects bad numbers and blank grade', () => {
    expect(validateGrade({ min_score: 50, max_score: 40, grade: 'D', remark: '' }, []).ok).toBe(false)
    expect(validateGrade({ min_score: -1, max_score: 40, grade: 'D', remark: '' }, []).ok).toBe(false)
    expect(validateGrade({ min_score: 0, max_score: 101, grade: 'D', remark: '' }, []).ok).toBe(false)
    expect(validateGrade({ min_score: 0, max_score: 10, grade: ' ', remark: '' }, []).ok).toBe(false)
  })
  it('lets a row be edited without clashing with itself', () => {
    expect(validateGrade({ ...a, min_score: 78 }, [a, b]).ok).toBe(false)
    expect(validateGrade({ ...a, remark: 'Top' }, [a, b]).ok).toBe(true)
  })
})

describe('gaps', () => {
  it('finds nothing wrong with the starter scale', () => {
    expect(gaps(STARTER_SCALE)).toEqual([])
  })
  it('lists scores no grade covers', () => {
    expect(gaps([a, b])).toEqual(['0 to 69'])
  })
})

describe('standard classes', () => {
  it('has 14 classes from Creche to JHS 3', () => {
    expect(STANDARD_CLASSES).toHaveLength(14)
    expect(STANDARD_CLASSES[0].name).toBe('Creche')
    expect(STANDARD_CLASSES[13].name).toBe('JHS 3')
  })
})

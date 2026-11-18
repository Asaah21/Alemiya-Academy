import { describe, expect, it } from 'vitest'
import { daysPresent } from './attendance'

describe('daysPresent (rules A4, A5)', () => {
  it('counts a student with no absences as present all week', () => {
    expect(daysPresent(5, 0)).toBe(5)
  })

  it('subtracts days absent from school days', () => {
    expect(daysPresent(5, 2)).toBe(3)
    expect(daysPresent(4, 4)).toBe(0)
  })

  it('blocks days absent above school days', () => {
    expect(() => daysPresent(5, 6)).toThrow()
  })

  it('blocks negative or fractional values', () => {
    expect(() => daysPresent(5, -1)).toThrow()
    expect(() => daysPresent(5, 1.5)).toThrow()
  })
})

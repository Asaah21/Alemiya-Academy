import { describe, expect, it } from 'vitest'
import { cashTotal, classesMissingAttendance } from './home'

describe('home helpers', () => {
  it('lists classes with no attendance this week', () => {
    const cs = [{ id: 'a', name: 'Basic 1' }, { id: 'b', name: 'Basic 2' }]
    expect(classesMissingAttendance(cs, ['a'])).toEqual([{ id: 'b', name: 'Basic 2' }])
    expect(classesMissingAttendance(cs, ['a', 'b'])).toEqual([])
  })
  it('adds only valid payments', () => {
    expect(cashTotal([{ amount: '10.10', status: 'valid' }, { amount: 20.2, status: 'valid' }, { amount: 99, status: 'void' }])).toBe(30.3)
  })
})

import { describe, expect, it } from 'vitest'
import { attritionRate, checkRoll, isQuiet, turnoverLines, type TurnoverRow } from './turnover'

const row = (class_id: string, gender: 'male' | 'female', o: Partial<TurnoverRow>): TurnoverRow => ({
  class_id, gender, opening: 0, new_admissions: 0, transfers_in: 0, transfers_out: 0, withdrawn: 0, graduated: 0, promoted_in: 0, promoted_out: 0, closing: 0, ...o,
})

describe('attritionRate', () => {
  it('is (transfers out + withdrawn) / opening x 100', () => {
    expect(attritionRate({ opening: 40, transfers_out: 1, withdrawn: 2 })).toBe(7.5)
    expect(attritionRate({ opening: 3, transfers_out: 1, withdrawn: 0 })).toBe(33.3)
  })
  it('is blank when nobody was on the roll at the start', () => expect(attritionRate({ opening: 0, transfers_out: 0, withdrawn: 0 })).toBeNull())
})

describe('turnoverLines', () => {
  const rows = [
    row('a', 'male', { opening: 10, new_admissions: 2, withdrawn: 1, closing: 11 }),
    row('a', 'female', { opening: 12, transfers_in: 1, transfers_out: 2, closing: 11 }),
    row('b', 'male', { opening: 8, graduated: 8, closing: 0 }),
    row('b', 'female', { opening: 0 }),
  ]
  it('adds boys and girls for each class and works out net change and attrition', () => {
    const { lines, total } = turnoverLines(rows, ['a', 'b'], 'all')
    expect(lines[0]).toMatchObject({ class_id: 'a', opening: 22, new_admissions: 2, transfers_in: 1, transfers_out: 2, withdrawn: 1, closing: 22, net: 0, attrition: 13.6 })
    expect(lines[1]).toMatchObject({ opening: 8, graduated: 8, closing: 0, net: -8, attrition: 0 })
    expect(total).toMatchObject({ opening: 30, closing: 22, net: -8 })
  })
  it('filters by gender', () => {
    const { lines, total } = turnoverLines(rows, ['a', 'b'], 'female')
    expect(lines[0]).toMatchObject({ opening: 12, closing: 11, attrition: 16.7 })
    expect(total.opening).toBe(12)
  })
  it('spots classes with nothing to show, and rows that do not add up', () => {
    const { lines } = turnoverLines(rows, ['a', 'b', 'c'], 'all')
    expect(isQuiet(lines[2])).toBe(true)
    expect(isQuiet(lines[0])).toBe(false)
    expect(lines.every(checkRoll)).toBe(true)
    expect(checkRoll({ opening: 5, new_admissions: 0, transfers_in: 0, promoted_in: 0, transfers_out: 0, withdrawn: 0, graduated: 0, promoted_out: 0, closing: 6 })).toBe(false)
  })
})

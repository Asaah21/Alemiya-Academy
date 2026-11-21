import { describe, expect, it } from 'vitest'
import { defaultPromotionDate, nextClassMap, planPromotion } from './promotion'

const classes = [{ id: 'c3', name: 'JHS 3', level_order: 14 }, { id: 'c1', name: 'Basic 5', level_order: 10 }, { id: 'c2', name: 'Basic 6', level_order: 11 }]

describe('promotion preview', () => {
  it('finds the next class by order and none for the last', () => {
    const m = nextClassMap(classes)
    expect(m.c1?.id).toBe('c2')
    expect(m.c2?.id).toBe('c3')
    expect(m.c3).toBeNull()
  })
  it('counts promoted, repeated and graduating students', () => {
    const students = [{ id: 'a', class_id: 'c1' }, { id: 'b', class_id: 'c1' }, { id: 'c', class_id: 'c3' }, { id: 'd', class_id: 'c3' }]
    expect(planPromotion(classes, students, new Set(['b', 'd']))).toEqual({ promoted: 1, repeated: 2, graduated: 1 })
  })
  it('defaults the date to the day after the term, capped at today', () => {
    expect(defaultPromotionDate('2026-07-17', '2026-11-21')).toBe('2026-07-18')
    expect(defaultPromotionDate('2026-07-17', '2026-07-17')).toBe('2026-07-17')
  })
})

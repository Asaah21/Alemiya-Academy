import { describe, expect, it } from 'vitest'
import { menuFor } from './menu'

describe('menu', () => {
  it('shows Admin everything', () => {
    const labels = menuFor('admin').map((m) => m.label)
    expect(labels).toEqual(['Home', 'Students', 'Weekly Attendance', 'Enter Scores', 'Report Cards', 'Fees', 'Reports', 'Setup'])
  })
  it('hides Admin-only items from Staff', () => {
    const labels = menuFor('staff').map((m) => m.label)
    expect(labels).not.toContain('Setup')
    expect(labels).not.toContain('Reports')
    expect(labels).toContain('Fees')
  })
})

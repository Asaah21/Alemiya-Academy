import { describe, expect, it } from 'vitest'
import { findSection, GROUPS, linksFor, sectionIdFor, sectionsFor } from './menu'

const labels = (role: 'admin' | 'staff') => sectionsFor(role).flatMap((g) => g.sections.map((s) => s.label))

describe('menu', () => {
  it('shows Admin every section in two groups', () => {
    expect(sectionsFor('admin').map((g) => g.title)).toEqual(['Academics', 'Administration'])
    expect(labels('admin')).toEqual(['Students', 'Staff', 'Exams', 'Timetable', 'Fees', 'Notices', 'Reports', 'Set up'])
  })
  it('hides Admin-only sections from Staff', () => {
    expect(labels('staff')).toEqual(['Students', 'Exams', 'Timetable', 'Fees', 'Notices'])
  })
  it('hides Admin-only links inside a section from Staff', () => {
    const fees = findSection('fees')!
    expect(linksFor(fees, 'staff').map((l) => l.path)).toEqual(['/fees', '/fees/balances'])
    expect(linksFor(fees, 'admin').map((l) => l.path)).toContain('/fees/cash')
  })
  it('never lists the same page under two sections', () => {
    const paths = GROUPS.flatMap((g) => g.sections.flatMap((s) => s.links.map((l) => l.path)))
    expect(new Set(paths).size).toBe(paths.length)
  })
  it('finds which section a page belongs to', () => {
    expect(sectionIdFor('/students/abc')).toBe('students')
    expect(sectionIdFor('/setup/staff')).toBe('staff')
    expect(sectionIdFor('/setup/years')).toBe('setup')
    expect(sectionIdFor('/scores/results')).toBe('exams')
    expect(sectionIdFor('/account')).toBeNull()
  })
})

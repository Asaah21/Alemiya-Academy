import { describe, expect, it } from 'vitest'
import { filterStudents, validateStudent, type StudentInput } from './students'

const good: StudentInput = { full_name: 'Ama Mensah', gender: 'female', date_of_birth: '2015-03-01', class_id: 'c1', guardian_name: 'Kofi', guardian_phone: '0241234567', admitted_on: '2026-09-07' }

describe('validateStudent', () => {
  it('accepts a complete student, and one with only the required fields', () => {
    expect(validateStudent(good).ok).toBe(true)
    expect(validateStudent({ ...good, date_of_birth: '', guardian_name: '', guardian_phone: '' }).ok).toBe(true)
  })
  it('rejects missing name, gender, class, future birth date and bad phone', () => {
    expect(validateStudent({ ...good, full_name: 'A' }).ok).toBe(false)
    expect(validateStudent({ ...good, gender: '' }).ok).toBe(false)
    expect(validateStudent({ ...good, class_id: '' }).ok).toBe(false)
    expect(validateStudent({ ...good, date_of_birth: '2999-01-01' }).ok).toBe(false)
    expect(validateStudent({ ...good, guardian_phone: 'call me' }).ok).toBe(false)
  })
})

describe('filterStudents', () => {
  const list = [
    { admission_no: 'ALM-2026-001', full_name: 'Ama Mensah', guardian_name: 'Kofi Mensah', guardian_phone: '0241111111', class_id: 'c1', status: 'active' },
    { admission_no: 'ALM-2026-002', full_name: 'Yaw Boateng', guardian_name: null, guardian_phone: null, class_id: 'c2', status: 'withdrawn' },
  ]
  it('searches name, number, guardian and phone', () => {
    expect(filterStudents(list, { search: 'ama', classId: '', status: '' })).toHaveLength(1)
    expect(filterStudents(list, { search: '002', classId: '', status: '' })[0].full_name).toBe('Yaw Boateng')
    expect(filterStudents(list, { search: 'kofi', classId: '', status: '' })).toHaveLength(1)
    expect(filterStudents(list, { search: '0241', classId: '', status: '' })).toHaveLength(1)
  })
  it('filters by class and status', () => {
    expect(filterStudents(list, { search: '', classId: 'c2', status: '' })).toHaveLength(1)
    expect(filterStudents(list, { search: '', classId: '', status: 'active' })).toHaveLength(1)
    expect(filterStudents(list, { search: 'ama', classId: 'c2', status: '' })).toHaveLength(0)
  })
})

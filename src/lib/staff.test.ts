import { describe, expect, it } from 'vitest'
import { filterStaff, validateStaff } from './staff'

const ok = { full_name: 'Mr Owusu', phone: '0241234567', subject_notes: 'Maths', class_id: '' }

describe('validateStaff', () => {
  it('accepts a name with or without a phone and class', () => {
    expect(validateStaff(ok).ok).toBe(true)
    expect(validateStaff({ ...ok, phone: '' }).ok).toBe(true)
  })
  it('rejects a short name and a bad phone', () => {
    expect(validateStaff({ ...ok, full_name: 'A' }).ok).toBe(false)
    expect(validateStaff({ ...ok, phone: 'abc' }).ok).toBe(false)
  })
})

describe('filterStaff', () => {
  const list = [
    { full_name: 'Mr Owusu', phone: '0241234567', subject_notes: 'Maths', status: 'active' },
    { full_name: 'Mrs Addo', phone: null, subject_notes: 'English', status: 'inactive' },
  ]
  it('searches name, phone and subject', () => {
    expect(filterStaff(list, { search: 'owusu', status: '' })).toHaveLength(1)
    expect(filterStaff(list, { search: '0241', status: '' })).toHaveLength(1)
    expect(filterStaff(list, { search: 'english', status: '' })).toHaveLength(1)
  })
  it('filters by status', () => {
    expect(filterStaff(list, { search: '', status: 'active' }).map((s) => s.full_name)).toEqual(['Mr Owusu'])
  })
})

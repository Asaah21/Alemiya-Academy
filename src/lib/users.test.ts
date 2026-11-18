import { describe, expect, it } from 'vitest'
import { generatePassword, validateNewUser, validatePassword } from './users'

const good = { email: ' Teacher@School.com ', full_name: 'Ama Mensah', role: 'staff', password: 'abcd1234' }

describe('validateNewUser', () => {
  it('accepts a good user and tidies the email', () => {
    const r = validateNewUser(good)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.email).toBe('teacher@school.com')
      expect(r.value.phone).toBeNull()
    }
  })

  it('rejects a bad email, short name, wrong role and short password', () => {
    expect(validateNewUser({ ...good, email: 'nope' }).ok).toBe(false)
    expect(validateNewUser({ ...good, full_name: 'A' }).ok).toBe(false)
    expect(validateNewUser({ ...good, role: 'parent' }).ok).toBe(false)
    expect(validateNewUser({ ...good, role: 'superuser' }).ok).toBe(false)
    expect(validateNewUser({ ...good, password: 'short' }).ok).toBe(false)
    expect(validateNewUser(undefined).ok).toBe(false)
  })
})

describe('passwords', () => {
  it('needs at least 8 characters', () => {
    expect(validatePassword('1234567').ok).toBe(false)
    expect(validatePassword('12345678').ok).toBe(true)
  })

  it('generates readable, different passwords that pass validation', () => {
    const a = generatePassword()
    const b = generatePassword()
    expect(a).toHaveLength(10)
    expect(a).not.toBe(b)
    expect(a).not.toMatch(/[01OIl]/)
    expect(validatePassword(a).ok).toBe(true)
  })
})

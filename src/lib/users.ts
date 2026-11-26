// Validation and helpers for creating users. Shared by the Users screen and the server function.

import { checkEmail, checkName, checkOptionalPhone } from './validation'
export type UserRole = 'admin' | 'staff'
export const USER_ROLES: UserRole[] = ['admin', 'staff']
export const MIN_PASSWORD_LENGTH = 8

export type NewUserInput = {
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  password: string
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

export function validatePassword(password: unknown): Validation<string> {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.` }
  }
  return { ok: true, value: password }
}

export function validateNewUser(input: unknown): Validation<NewUserInput> {
  const b = (input ?? {}) as Record<string, unknown>
  const e = checkEmail(typeof b.email === 'string' ? b.email : '')
  if (!e.ok) return { ok: false, error: e.error }
  const n = checkName(typeof b.full_name === 'string' ? b.full_name : '', 'full name')
  if (!n.ok) return { ok: false, error: n.error }
  const email = e.value
  const fullName = n.value
  if (!USER_ROLES.includes(b.role as UserRole)) {
    return { ok: false, error: 'Choose Admin or Staff.' }
  }
  const pw = validatePassword(b.password)
  if (!pw.ok) return pw
  const ph = checkOptionalPhone(typeof b.phone === 'string' ? b.phone : '')
  if (!ph.ok) return { ok: false, error: ph.error }
  const phone = ph.value
  return {
    ok: true,
    value: { email, full_name: fullName, role: b.role as UserRole, phone, password: pw.value },
  }
}

// Easy-to-read temporary password (no 0/O or 1/l/I), for the Admin to write down and hand over.
export function generatePassword(length = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => chars[n % chars.length]).join('')
}

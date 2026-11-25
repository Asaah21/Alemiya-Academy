import { describe, expect, it } from 'vitest'
import { friendlyError, saved } from './errors'

describe('friendlyError', () => {
  it('keeps plain sentences raised by our own rules', () => {
    expect(friendlyError({ message: 'Close every term of this year first' })).toBe('Close every term of this year first')
    expect(friendlyError({ message: 'Only the Admin can promote students' })).toBe('Only the Admin can promote students')
  })
  it('explains a lost connection', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/No internet connection/)
  })
  it('explains an ended sign-in and missing permission', () => {
    expect(friendlyError({ message: 'JWT expired' })).toMatch(/sign in again/)
    expect(friendlyError({ message: 'new row violates row-level security policy for table "payments"' })).toBe('You are not allowed to do this.')
  })
  it('turns duplicates and technical text into clean messages', () => {
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "x"' })).toBe('This already exists.')
    expect(friendlyError({ message: 'column "foo" of relation "bar" does not exist' }, 'Could not save.')).toBe('Could not save.')
    expect(friendlyError(null)).toBe('Something went wrong. Please try again.')
  })
  it('words saves the same way', () => {
    expect(saved('Scores')).toBe('Scores saved.')
  })
})

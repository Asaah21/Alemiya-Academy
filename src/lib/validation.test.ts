import { describe, expect, it } from 'vitest'
import { checkBirthDate, checkEmail, checkName, checkOptionalPhone, checkPhone } from './validation'

describe('checkName', () => {
  it('accepts normal names and tidies spaces', () => {
    expect(checkName('  Amiah   Eric ')).toEqual({ ok: true, value: 'Amiah Eric' })
    expect(checkName("Ama O'Brien-Mensah")).toMatchObject({ ok: true })
    expect(checkName('Ábéná')).toMatchObject({ ok: true })
  })
  it('needs at least 3 letters', () => {
    expect(checkName('Al', 'full name')).toEqual({ ok: false, error: 'The full name must have at least 3 letters.' })
    expect(checkName('   ')).toMatchObject({ ok: false })
  })
  it('refuses numbers and symbols', () => {
    expect(checkName('Kofi 123')).toMatchObject({ ok: false, error: expect.stringMatching(/only have letters/) })
    expect(checkName('<b>Kofi</b>')).toMatchObject({ ok: false })
  })
})

describe('checkPhone', () => {
  it('accepts a 10 digit number starting with 0, ignoring spaces and dashes', () => {
    expect(checkPhone('0241234567')).toEqual({ ok: true, value: '0241234567' })
    expect(checkPhone('024 123-4567')).toEqual({ ok: true, value: '0241234567' })
  })
  it('turns +233 and 233 into 0', () => {
    expect(checkPhone('+233241234567')).toEqual({ ok: true, value: '0241234567' })
    expect(checkPhone('233241234567')).toEqual({ ok: true, value: '0241234567' })
  })
  it('says how many digits were typed when the length is wrong', () => {
    expect(checkPhone('024123456')).toMatchObject({ ok: false, error: expect.stringMatching(/exactly 10 digits.*You typed 9/) })
    expect(checkPhone('02412345678')).toMatchObject({ ok: false })
  })
  it('refuses letters and numbers not starting with 0', () => {
    expect(checkPhone('call me')).toMatchObject({ ok: false, error: expect.stringMatching(/only have numbers/) })
    expect(checkPhone('1241234567')).toMatchObject({ ok: false, error: expect.stringMatching(/start with 0/) })
  })
  it('allows a blank optional phone', () => {
    expect(checkOptionalPhone('  ')).toEqual({ ok: true, value: null })
    expect(checkOptionalPhone('0241234567')).toEqual({ ok: true, value: '0241234567' })
    expect(checkOptionalPhone('12')).toMatchObject({ ok: false })
  })
})

describe('checkEmail and birth date', () => {
  it('checks email', () => {
    expect(checkEmail(' Ama@Example.com ')).toEqual({ ok: true, value: 'ama@example.com' })
    expect(checkEmail('ama@')).toMatchObject({ ok: false })
    expect(checkEmail('')).toMatchObject({ ok: false })
  })
  it('keeps a pupil birth date sensible', () => {
    expect(checkBirthDate('', '2026-11-26')).toEqual({ ok: true, value: null })
    expect(checkBirthDate('2018-05-01', '2026-11-26')).toEqual({ ok: true, value: '2018-05-01' })
    expect(checkBirthDate('2026-11-26', '2026-11-26')).toMatchObject({ ok: false })
    expect(checkBirthDate('1950-01-01', '2026-11-26')).toMatchObject({ ok: false })
  })
})

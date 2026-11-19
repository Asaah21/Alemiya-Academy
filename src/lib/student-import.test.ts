import { describe, expect, it } from 'vitest'
import { checkImport, fixPhone, parseCsv, parseDate, parseGender, TEMPLATE_CSV, toRecords } from './student-import'

const classes = [{ id: 'c3', name: 'Basic 3' }, { id: 'c5', name: 'Basic 5' }]

describe('parseCsv', () => {
  it('reads quotes, commas inside quotes and blank lines', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['']])
  })
  it('ignores a byte-order mark', () => {
    expect(parseCsv('﻿Name,Gender\nAma,F')[0]).toEqual(['Name', 'Gender'])
  })
})

describe('template', () => {
  it('imports cleanly as written', () => {
    const r = checkImport(toRecords(parseCsv(TEMPLATE_CSV)), classes, [], '2026-11-19')
    expect(r.errors).toEqual([])
    expect(r.ready).toHaveLength(2)
    expect(r.ready[0]).toMatchObject({ full_name: 'Ama Mensah', gender: 'female', class_id: 'c3', date_of_birth: '2015-03-21' })
  })
})

describe('helpers', () => {
  it('reads genders and dates', () => {
    expect(parseGender('F')).toBe('female')
    expect(parseGender('Boy')).toBe('male')
    expect(parseGender('x')).toBeNull()
    expect(parseDate('21/03/2015')).toBe('2015-03-21')
    expect(parseDate('2015-3-1')).toBe('2015-03-01')
    expect(parseDate('31/02/2015')).toBeNull()
    expect(parseDate('')).toBe('')
  })
  it('puts back the zero Excel removes', () => {
    expect(fixPhone('241234567')).toBe('0241234567')
    expect(fixPhone('0241234567')).toBe('0241234567')
  })
})

describe('checkImport', () => {
  const head = 'Full name,Gender,Date of birth,Class,Guardian name,Guardian phone,Admission number\n'

  it('lists every problem row with its line number and imports nothing as ready for those rows', () => {
    const csv = head +
      'Ama Mensah,Female,2015-03-21,Basic 3,,,\n' +
      ',Male,2014-01-01,Basic 3,,,\n' +
      'Kofi Y,Boy,2014-01-01,Basic 9,,,\n' +
      'Esi Z,Female,not a date,Basic 5,,12ab,\n'
    const r = checkImport(toRecords(parseCsv(csv)), classes, [], '2026-11-19')
    expect(r.ready).toHaveLength(1)
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5])
    expect(r.errors[1].message).toContain('Basic 9')
  })

  it('catches repeats in the file and students who already exist', () => {
    const csv = head + 'Ama Mensah,Female,2015-03-21,Basic 3,,,ALM-2026-001\nAma Mensah,Female,2015-03-21,Basic 3,,,\nKwame B,Male,2014-05-05,Basic 5,,,ALM-2026-001\n'
    const r = checkImport(toRecords(parseCsv(csv)), classes, [{ admission_no: 'ALM-2026-001', full_name: 'Old Pupil', date_of_birth: null }], '2026-11-19')
    expect(r.ready).toHaveLength(0)
    expect(r.errors).toHaveLength(3)
  })

  it('works with columns in any order and Basic3 spelled without a space', () => {
    const csv = 'Class,Name,Sex\nBasic3,Ama,F\n'
    const r = checkImport(toRecords(parseCsv(csv)), classes, [], '2026-11-19')
    expect(r.errors).toEqual([])
    expect(r.ready[0].class_id).toBe('c3')
  })

  it('asks for the template when headings are missing', () => {
    const r = toRecords(parseCsv('Foo,Bar\n1,2\n'))
    expect(r.errors[0].message).toContain('Use the template')
  })

  it('imports 50 students in one go', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Pupil ${i + 1},${i % 2 ? 'Male' : 'Female'},2015-01-${String((i % 28) + 1).padStart(2, '0')},Basic 3,,,`)
    const r = checkImport(toRecords(parseCsv(head + lines.join('\n'))), classes, [], '2026-11-19')
    expect(r.errors).toEqual([])
    expect(r.ready).toHaveLength(50)
  })

  it('refuses files over 500 students', () => {
    const lines = Array.from({ length: 501 }, (_, i) => `P${i},Male,,Basic 3,,,`)
    expect(toRecords(parseCsv(head + lines.join('\n'))).errors).toHaveLength(1)
  })
})

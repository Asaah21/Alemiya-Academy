import { describe, expect, it } from 'vitest'
import { checkTimetableFile, MAX_BYTES, safeFileName, sizeLabel, storagePath } from './timetable'

describe('checkTimetableFile', () => {
  it('accepts PDF, pictures and Word files', () => {
    expect(checkTimetableFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toEqual({ ok: true })
    expect(checkTimetableFile({ name: 'a.png', type: 'image/png', size: 1000 })).toEqual({ ok: true })
    expect(checkTimetableFile({ name: 'a.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 }).ok).toBe(true)
  })
  it('refuses empty, big and other file types', () => {
    expect(checkTimetableFile({ name: 'a.pdf', type: 'application/pdf', size: 0 }).ok).toBe(false)
    expect(checkTimetableFile({ name: 'a.pdf', type: 'application/pdf', size: MAX_BYTES + 1 })).toMatchObject({ ok: false, error: expect.stringMatching(/10 MB/) })
    expect(checkTimetableFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10 })).toMatchObject({ ok: false })
  })
})

describe('storage names', () => {
  it('makes any file name safe', () => {
    expect(safeFileName('Term 1 Timetable (final).pdf')).toBe('Term-1-Timetable-final.pdf')
    expect(safeFileName('../../etc/passwd')).toBe('....etcpasswd')
    expect(safeFileName('???')).toBe('timetable')
  })
  it('puts the file under its term', () => {
    expect(storagePath('t1', 'My file.pdf', 123)).toBe('t1/123-My-file.pdf')
  })
  it('shows a readable size', () => {
    expect(sizeLabel(2048)).toBe('2 KB')
    expect(sizeLabel(3 * 1024 * 1024)).toBe('3.0 MB')
    expect(sizeLabel(null)).toBe('')
  })
})

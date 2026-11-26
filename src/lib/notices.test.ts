import { describe, expect, it } from 'vitest'
import { BODY_MAX, checkNotice, noticeDate } from './notices'

describe('checkNotice', () => {
  it('trims and sets the audience', () => {
    expect(checkNotice({ title: '  Hello ', body: ' World ', forParents: true })).toEqual({ ok: true, value: { title: 'Hello', body: 'World', audience: 'staff_and_parents' } })
    expect(checkNotice({ title: 'a', body: 'b', forParents: false })).toMatchObject({ ok: true, value: { audience: 'staff' } })
  })
  it('asks for a title and a message', () => {
    expect(checkNotice({ title: ' ', body: 'x', forParents: false })).toEqual({ ok: false, error: 'Enter a title.' })
    expect(checkNotice({ title: 'x', body: ' ', forParents: false })).toEqual({ ok: false, error: 'Write the message.' })
  })
  it('stops over-long text', () => {
    expect(checkNotice({ title: 'x'.repeat(121), body: 'b', forParents: false })).toMatchObject({ ok: false })
    expect(checkNotice({ title: 'x', body: 'b'.repeat(BODY_MAX + 1), forParents: false })).toMatchObject({ ok: false })
  })
})

describe('noticeDate', () => {
  const now = new Date(2026, 10, 25, 15, 0)
  it('says Today and Yesterday', () => {
    expect(noticeDate(new Date(2026, 10, 25, 8, 0).toISOString(), now)).toBe('Today')
    expect(noticeDate(new Date(2026, 10, 24, 23, 0).toISOString(), now)).toBe('Yesterday')
  })
  it('shows a date for older notices', () => {
    expect(noticeDate(new Date(2026, 10, 1, 9, 0).toISOString(), now)).toBe('1 Nov 2026')
  })
})

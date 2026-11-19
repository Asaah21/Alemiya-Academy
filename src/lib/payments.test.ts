import { describe, expect, it } from 'vitest'
import { balanceOf, receiptDate, validatePayment, wouldOverpay } from './payments'

describe('validatePayment', () => {
  it('accepts a good amount and date', () => expect(validatePayment('150.50', '2026-11-10', '2026-11-19')).toEqual({ ok: true, amount: 150.5 }))
  it('refuses zero, junk, a missing date and a future date', () => {
    expect(validatePayment('0', '2026-11-10', '2026-11-19').ok).toBe(false)
    expect(validatePayment('abc', '2026-11-10', '2026-11-19').ok).toBe(false)
    expect(validatePayment('10', '', '2026-11-19').ok).toBe(false)
    expect(validatePayment('10', '2026-11-20', '2026-11-19').ok).toBe(false)
  })
})

describe('balanceOf', () => {
  it('counts only valid payments', () => {
    expect(balanceOf(300, [{ amount: 100, status: 'valid' }, { amount: 50, status: 'void' }, { amount: 20.1, status: 'valid' }])).toEqual({ owed: 300, paid: 120.1, balance: 179.9 })
  })
  it('shows overpayment as a negative balance', () => {
    const b = balanceOf(100, [{ amount: 120, status: 'valid' }])
    expect(b.balance).toBe(-20)
    expect(wouldOverpay({ owed: 100, paid: 0, balance: 100 }, 101)).toBe(true)
    expect(wouldOverpay({ owed: 100, paid: 0, balance: 100 }, 100)).toBe(false)
  })
})

describe('receiptDate', () => {
  it('writes the date in full', () => expect(receiptDate('2026-11-05')).toBe('5 November 2026'))
})

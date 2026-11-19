import { describe, expect, it } from 'vitest'
import { formatMoney, itemsToCopy, parseAmount, totalFees, validateFeeItem } from './fees'

describe('parseAmount', () => {
  it('reads plain, comma and cedi-sign amounts', () => {
    expect(parseAmount('250')).toBe(250)
    expect(parseAmount('1,200.5')).toBe(1200.5)
    expect(parseAmount('GH₵ 300')).toBe(300)
  })
  it('refuses junk, negatives, 3 decimals and huge amounts', () => {
    for (const t of ['', 'abc', '-5', '10.123', '1e3', '2000000']) expect(parseAmount(t)).toBeNull()
  })
  it('allows zero', () => expect(parseAmount('0')).toBe(0))
})

describe('validateFeeItem', () => {
  it('tidies the name', () => expect(validateFeeItem('  School   fees ', '300')).toEqual({ ok: true, name: 'School fees', amount: 300 }))
  it('explains problems', () => {
    expect(validateFeeItem('A', '5')).toMatchObject({ ok: false })
    expect(validateFeeItem('PTA', 'x')).toMatchObject({ ok: false })
  })
})

describe('totals and copying', () => {
  it('adds without floating point drift', () => expect(totalFees([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3))
  it('formats', () => expect(formatMoney(1200)).toBe('GH₵ 1,200.00'))
  it('copies only items not already there, ignoring case', () => {
    expect(itemsToCopy([{ name: 'PTA', amount: 20 }, { name: 'Books', amount: 50 }], [{ name: 'pta' }])).toEqual([{ name: 'Books', amount: 50 }])
  })
})

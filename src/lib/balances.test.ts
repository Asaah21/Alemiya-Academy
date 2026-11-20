import { describe, expect, it } from 'vitest'
import { balanceTotals, byDebt, owingOnly, summariseCash, totalDue, type BalanceRow, type CashPayment } from './balances'

const row = (name: string, owed: number, paid: number, arrears = 0): BalanceRow => ({ student_id: name, admission_no: name, full_name: name, class_id: null, owed, paid, balance: owed - paid, arrears })

describe('balances', () => {
  const rows = [row('Ama', 320, 100), row('Kofi', 320, 320), row('Yaw', 320, 400, -0), row('Esi', 320, 320, 50)]
  it('total due adds arrears, and never goes below zero', () => {
    expect(totalDue(rows[0])).toBe(220)
    expect(totalDue(rows[2])).toBe(0)
    expect(totalDue(row('X', 100, 100, -30))).toBe(0)
    expect(totalDue(rows[3])).toBe(50)
  })
  it('lists only those who owe, biggest debt first', () => {
    expect(owingOnly(rows).map((r) => r.full_name)).toEqual(['Ama', 'Esi'])
    expect(byDebt(rows).map((r) => r.full_name)).toEqual(['Ama', 'Esi', 'Kofi', 'Yaw'])
  })
  it('totals and collection rate', () => {
    expect(balanceTotals(rows)).toEqual({ owed: 1280, paid: 1140, due: 270, students: 4, owing: 2, collectionRate: 89.1 })
    expect(balanceTotals([row('A', 0, 0)]).collectionRate).toBeNull()
  })
})

describe('summariseCash', () => {
  const p = (amount: number, by: string | null, status: 'valid' | 'void' = 'valid'): CashPayment => ({ id: String(Math.random()), amount, receipt_no: 'R', status, received_by: by, student_id: 's' })
  const names = new Map([['u1', 'Mr Mensah'], ['u2', 'Mad Ama']])
  it('counts valid cash by who received it and shows voids apart', () => {
    const s = summariseCash([p(100, 'u1'), p(50.5, 'u2'), p(20, 'u1'), p(70, 'u1', 'void'), p(5, null)], names)
    expect(s.total).toBe(175.5)
    expect(s.count).toBe(4)
    expect(s.voidedCount).toBe(1)
    expect(s.voidedTotal).toBe(70)
    expect(s.byReceiver).toEqual([{ receiver: 'Mr Mensah', total: 120, count: 2 }, { receiver: 'Mad Ama', total: 50.5, count: 1 }, { receiver: 'Unknown', total: 5, count: 1 }])
  })
  it('handles a day with no payments', () => {
    expect(summariseCash([], names)).toEqual({ total: 0, count: 0, voidedCount: 0, voidedTotal: 0, byReceiver: [] })
  })
})

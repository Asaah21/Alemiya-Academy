// Balances, arrears and the daily cash summary (rules F4, F5).

export type BalanceRow = { student_id: string; admission_no: string; full_name: string; class_id: string | null; owed: number; paid: number; balance: number; arrears: number }

// Total still to pay: this term's balance plus arrears from earlier terms (never below zero for one student).
export const totalDue = (r: Pick<BalanceRow, 'balance' | 'arrears'>): number => Math.max(0, Math.round((r.balance + r.arrears) * 100) / 100)

export function owingOnly(rows: BalanceRow[]): BalanceRow[] {
  return rows.filter((r) => totalDue(r) > 0)
}

// Biggest debt first; ties by name.
export function byDebt(rows: BalanceRow[]): BalanceRow[] {
  return [...rows].sort((a, b) => totalDue(b) - totalDue(a) || a.full_name.localeCompare(b.full_name))
}

export type BalanceTotals = { owed: number; paid: number; due: number; students: number; owing: number; collectionRate: number | null }

export function balanceTotals(rows: BalanceRow[]): BalanceTotals {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const owed = r2(rows.reduce((s, r) => s + r.owed, 0))
  const paid = r2(rows.reduce((s, r) => s + r.paid, 0))
  return {
    owed, paid,
    due: r2(rows.reduce((s, r) => s + totalDue(r), 0)),
    students: rows.length,
    owing: owingOnly(rows).length,
    collectionRate: owed > 0 ? Math.round((Math.min(paid, owed) / owed) * 1000) / 10 : null,
  }
}

export type CashPayment = { id: string; amount: number; receipt_no: string; status: 'valid' | 'void'; received_by: string | null; student_id: string }
export type CashSummary = { total: number; count: number; voidedCount: number; voidedTotal: number; byReceiver: { receiver: string; total: number; count: number }[] }

// Valid payments only count towards the cash in hand; voided ones are shown separately.
export function summariseCash(payments: CashPayment[], names: Map<string, string>): CashSummary {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const valid = payments.filter((p) => p.status === 'valid')
  const void_ = payments.filter((p) => p.status === 'void')
  const map = new Map<string, { total: number; count: number }>()
  for (const p of valid) {
    const k = (p.received_by && names.get(p.received_by)) || 'Unknown'
    const cur = map.get(k) ?? { total: 0, count: 0 }
    map.set(k, { total: cur.total + Number(p.amount), count: cur.count + 1 })
  }
  return {
    total: r2(valid.reduce((s, p) => s + Number(p.amount), 0)),
    count: valid.length,
    voidedCount: void_.length,
    voidedTotal: r2(void_.reduce((s, p) => s + Number(p.amount), 0)),
    byReceiver: [...map.entries()].map(([receiver, v]) => ({ receiver, total: r2(v.total), count: v.count })).sort((a, b) => b.total - a.total),
  }
}

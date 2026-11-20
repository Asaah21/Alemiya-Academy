// Cash payments and balances (rules F3 to F6).
import { parseAmount } from './fees'

export type Payment = { id: string; student_id: string; term_id: string; amount: number; paid_on: string; receipt_no: string; note: string | null; status: 'valid' | 'void'; received_by: string | null; void_reason?: string | null }

export type PaymentCheck = { ok: true; amount: number } | { ok: false; error: string }

export function validatePayment(amountText: string, paidOn: string, today: string): PaymentCheck {
  const amount = parseAmount(amountText)
  if (amount === null || amount <= 0) return { ok: false, error: 'Enter the amount paid in cedis, for example 150 or 150.50.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { ok: false, error: 'Choose the date of payment.' }
  if (paidOn > today) return { ok: false, error: 'The payment date cannot be in the future.' }
  return { ok: true, amount }
}

export type Balance = { owed: number; paid: number; balance: number }

// Only valid payments count. A negative balance means the student has paid more than is owed.
export function balanceOf(owed: number, payments: { amount: number; status: string }[]): Balance {
  const paid = Math.round(payments.filter((p) => p.status === 'valid').reduce((s, p) => s + Number(p.amount), 0) * 100) / 100
  return { owed, paid, balance: Math.round((owed - paid) * 100) / 100 }
}

export function wouldOverpay(b: Balance, amount: number): boolean {
  return amount > b.balance
}

export function receiptDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

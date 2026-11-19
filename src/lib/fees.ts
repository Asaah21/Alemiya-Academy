// Fee items: what a class pays in a term (rules F1, F2). Amounts are in Ghana cedis.

export type FeeItem = { id: string; class_id: string; term_id: string; name: string; amount: number }

export const MAX_AMOUNT = 1_000_000

// Accepts "250", "1,200", "1200.5", "GH₵ 300". Returns null when it is not a usable amount.
export function parseAmount(text: string): number | null {
  const t = text.replace(/GH[₵C]|₵|,|\s/gi, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = Number(t)
  return n > MAX_AMOUNT ? null : n
}

export function formatMoney(n: number): string {
  return `GH₵ ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type FeeCheck = { ok: true; name: string; amount: number } | { ok: false; error: string }

export function validateFeeItem(name: string, amountText: string): FeeCheck {
  const n = name.trim().replace(/\s+/g, ' ')
  if (n.length < 2) return { ok: false, error: 'Enter the name of the fee, for example School fees.' }
  if (n.length > 60) return { ok: false, error: 'The fee name is too long.' }
  const amount = parseAmount(amountText)
  if (amount === null) return { ok: false, error: 'Enter the amount in cedis, for example 250 or 250.50.' }
  return { ok: true, name: n, amount }
}

export function totalFees(items: { amount: number }[]): number {
  return Math.round(items.reduce((s, i) => s + Number(i.amount), 0) * 100) / 100
}

// Items from another term that this class/term does not have yet (matched by name), for "copy from a previous term".
export function itemsToCopy(source: { name: string; amount: number }[], existing: { name: string }[]): { name: string; amount: number }[] {
  const have = new Set(existing.map((e) => e.name.trim().toLowerCase()))
  return source.filter((s) => !have.has(s.name.trim().toLowerCase()))
}

// Enrolment turnover (rules S3, S4). The database counts the movements; this adds up the rows and works out the rates.

export type TurnoverRow = {
  class_id: string; gender: 'male' | 'female'
  opening: number; new_admissions: number; transfers_in: number; transfers_out: number
  withdrawn: number; graduated: number; promoted_in: number; promoted_out: number; closing: number
}

export type TurnoverLine = Omit<TurnoverRow, 'gender'> & { net: number; attrition: number | null }

// Attrition rate = (transfers out + withdrawn) / opening roll x 100. Nothing to divide by when the opening roll is 0.
export function attritionRate(r: Pick<TurnoverRow, 'opening' | 'transfers_out' | 'withdrawn'>): number | null {
  return r.opening > 0 ? Math.round(((r.transfers_out + r.withdrawn) / r.opening) * 1000) / 10 : null
}

const NUMBERS = ['opening', 'new_admissions', 'transfers_in', 'transfers_out', 'withdrawn', 'graduated', 'promoted_in', 'promoted_out', 'closing'] as const

function line(class_id: string, rows: TurnoverRow[]): TurnoverLine {
  const sum = Object.fromEntries(NUMBERS.map((k) => [k, rows.reduce((s, r) => s + Number(r[k]), 0)])) as Record<(typeof NUMBERS)[number], number>
  return { class_id, ...sum, net: sum.closing - sum.opening, attrition: attritionRate(sum) }
}

// One line per class (in the order given), filtered by gender, plus a school total.
export function turnoverLines(rows: TurnoverRow[], classIds: string[], gender: 'all' | 'male' | 'female'): { lines: TurnoverLine[]; total: TurnoverLine } {
  const use = rows.filter((r) => gender === 'all' || r.gender === gender)
  return { lines: classIds.map((c) => line(c, use.filter((r) => r.class_id === c))), total: line('total', use) }
}

export const isQuiet = (l: TurnoverLine): boolean => NUMBERS.every((k) => l[k] === 0)

export function checkRoll(l: Pick<TurnoverLine, 'opening' | 'new_admissions' | 'transfers_in' | 'promoted_in' | 'transfers_out' | 'withdrawn' | 'graduated' | 'promoted_out' | 'closing'>): boolean {
  return l.closing === l.opening + l.new_admissions + l.transfers_in + l.promoted_in - l.transfers_out - l.withdrawn - l.graduated - l.promoted_out
}

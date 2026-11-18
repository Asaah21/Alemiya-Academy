// Grading scale checks and the standard class list (used by the Setup screens).
export type GradeRow = { id?: string; min_score: number; max_score: number; grade: string; remark: string }
export type Check = { ok: true } | { ok: false; error: string }
const fail = (error: string): Check => ({ ok: false, error })

// Score ranges include both ends (70 to 79 covers 70 and 79), so 70-79 and 79-85 overlap.
export function validateGrade(g: GradeRow, others: GradeRow[]): Check {
  if (!g.grade.trim()) return fail('Enter the grade, for example A.')
  if (!Number.isFinite(g.min_score) || !Number.isFinite(g.max_score)) return fail('Enter the lowest and highest score.')
  if (g.min_score < 0 || g.max_score > 100) return fail('Scores must be between 0 and 100.')
  if (g.max_score < g.min_score) return fail('The highest score cannot be lower than the lowest score.')
  for (const o of others) {
    if (o.id && o.id === g.id) continue
    if (g.min_score <= o.max_score && o.min_score <= g.max_score) {
      return fail(`This range overlaps grade ${o.grade} (${o.min_score} to ${o.max_score}).`)
    }
  }
  return { ok: true }
}

// Scores not covered by any range (so a student could get no grade). Whole-number scores only.
export function gaps(rows: GradeRow[]): string[] {
  const sorted = [...rows].sort((a, b) => a.min_score - b.min_score)
  const out: string[] = []
  let next = 0
  for (const r of sorted) {
    if (r.min_score > next) out.push(r.min_score - 1 > next ? `${next} to ${r.min_score - 1}` : `${next}`)
    next = Math.max(next, Math.floor(r.max_score) + 1)
  }
  if (next <= 100) out.push(next < 100 ? `${next} to 100` : '100')
  return out
}

// The 14 classes, in order. The first three are remarks-only on the report card (rule G8); the Admin can change this.
export const STANDARD_CLASSES: { name: string; scored: boolean }[] = [
  { name: 'Creche', scored: false },
  { name: 'Nursery 1', scored: false },
  { name: 'Nursery 2', scored: false },
  { name: 'KG 1', scored: true },
  { name: 'KG 2', scored: true },
  { name: 'Basic 1', scored: true },
  { name: 'Basic 2', scored: true },
  { name: 'Basic 3', scored: true },
  { name: 'Basic 4', scored: true },
  { name: 'Basic 5', scored: true },
  { name: 'Basic 6', scored: true },
  { name: 'JHS 1', scored: true },
  { name: 'JHS 2', scored: true },
  { name: 'JHS 3', scored: true },
]

// A starter scale the Admin can edit (open question Q1).
export const STARTER_SCALE: GradeRow[] = [
  { min_score: 80, max_score: 100, grade: 'A', remark: 'Excellent' },
  { min_score: 70, max_score: 79, grade: 'B', remark: 'Very good' },
  { min_score: 60, max_score: 69, grade: 'C', remark: 'Good' },
  { min_score: 50, max_score: 59, grade: 'D', remark: 'Satisfactory' },
  { min_score: 40, max_score: 49, grade: 'E', remark: 'Pass' },
  { min_score: 0, max_score: 39, grade: 'F', remark: 'Needs improvement' },
]

// Score checks, subject totals and grades (rules G1 to G3, G6). Positions and overall totals come in T13.
import type { GradeRow } from './grades'

// Reads what staff typed: blank = not entered, otherwise a number with at most 2 decimals.
export function parseScore(text: string): { value: number | null } | { error: string } {
  const t = text.trim().replace(',', '.')
  if (t === '') return { value: null }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { error: 'Enter a number such as 24 or 24.5.' }
  return { value: Number(t) }
}

export type ScoreEntry = { classText: string; examText: string; absent: boolean }
export type ScoreCheck = { classScore: number | null; examScore: number | null; error: string | null }

// Rule G6: a score cannot be negative or above its maximum. An absent student has no scores.
export function checkScore(e: ScoreEntry, classMax: number, examMax: number): ScoreCheck {
  if (e.absent) return { classScore: null, examScore: null, error: null }
  const c = parseScore(e.classText)
  const x = parseScore(e.examText)
  if ('error' in c) return { classScore: null, examScore: null, error: `Class score: ${c.error}` }
  if ('error' in x) return { classScore: null, examScore: null, error: `Exam score: ${x.error}` }
  if (c.value !== null && c.value > classMax) return { classScore: c.value, examScore: x.value, error: `Class score cannot be more than ${classMax}.` }
  if (x.value !== null && x.value > examMax) return { classScore: c.value, examScore: x.value, error: `Exam score cannot be more than ${examMax}.` }
  return { classScore: c.value, examScore: x.value, error: null }
}

// Rule G2: subject total = class score + exam score. Not shown until at least one score is entered.
// An absent student counts as 0 (rule G6). A missing half counts as 0 in the running total, but the subject is
// "incomplete" until both are entered (rule G7, used in T13).
export function subjectTotal(classScore: number | null, examScore: number | null, absent: boolean): number | null {
  if (absent) return 0
  if (classScore === null && examScore === null) return null
  return Math.round(((classScore ?? 0) + (examScore ?? 0)) * 100) / 100
}

export function isComplete(classScore: number | null, examScore: number | null, absent: boolean): boolean {
  return absent || (classScore !== null && examScore !== null)
}

// Rule G3: the grade is the band with the highest lowest-score that is not above the total, so a total
// such as 79.5 falls in the 70 to 79 band instead of in a gap.
export function gradeFor(total: number | null, scale: GradeRow[]): { grade: string; remark: string } | null {
  if (total === null || total < 0 || total > 100) return null
  const band = [...scale].filter((b) => b.min_score <= total).sort((a, b) => b.min_score - a.min_score)[0]
  return band ? { grade: band.grade, remark: band.remark } : null
}

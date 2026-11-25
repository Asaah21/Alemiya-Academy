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

// One mark out of the maximum (normally 100) per subject. It is stored as an exam score with a class score of 0,
// so older rows entered as class + exam still add up to the same total.
export type SingleCheck = { score: number | null; error: string | null }
export function checkSingleScore(text: string, absent: boolean, max: number): SingleCheck {
  if (absent) return { score: null, error: null }
  const p = parseScore(text)
  if ('error' in p) return { score: null, error: p.error }
  if (p.value !== null && p.value > max) return { score: p.value, error: `The score cannot be more than ${max}.` }
  return { score: p.value, error: null }
}
/** What to show in the single box for a saved row (older rows show class + exam). */
export function savedMark(classScore: number | null, examScore: number | null): number | null {
  if (classScore === null && examScore === null) return null
  return Math.round(((classScore ?? 0) + (examScore ?? 0)) * 100) / 100
}
/** The values stored for one mark. */
export const markToColumns = (score: number | null) => ({ class_score: score === null ? null : 0, exam_score: score })

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

// ---------------------------------------------------------------------------
// T13: overall total, average, position (rules G4, G5, G7)
// ---------------------------------------------------------------------------
export type ScoreRow = { student_id: string; subject_id: string; class_score: number | null; exam_score: number | null; is_absent: boolean }

export type ResultRow = {
  studentId: string
  name: string
  subjectTotals: Record<string, number | null> // null = not complete yet
  overall: number // sum of the subject totals that are complete
  average: number | null // overall / number of subjects, only when every subject is complete
  position: number | null // only when the whole class is complete
}
export type MissingItem = { studentId: string; name: string; subject: string; what: 'class score' | 'exam score' | 'both scores' }
export type ClassResults = { rows: ResultRow[]; missing: MissingItem[]; complete: boolean }

const round2 = (n: number) => Math.round(n * 100) / 100

// Rule G5: students with the same overall total share a position, and the next position skips (1, 2, 2, 4).
export function rankWithTies(totals: number[]): number[] {
  const keys = totals.map(round2)
  return keys.map((t) => 1 + keys.filter((o) => o > t).length)
}

export function computeClassResults(
  students: { id: string; full_name: string }[],
  subjects: { id: string; name: string }[],
  scores: ScoreRow[],
): ClassResults {
  const by = new Map(scores.map((s) => [`${s.student_id}|${s.subject_id}`, s]))
  const missing: MissingItem[] = []
  const rows: ResultRow[] = students.map((st) => {
    const subjectTotals: Record<string, number | null> = {}
    let overall = 0
    let allDone = true
    for (const sub of subjects) {
      const s = by.get(`${st.id}|${sub.id}`)
      const c = s?.class_score ?? null
      const x = s?.exam_score ?? null
      const absent = s?.is_absent ?? false
      if (isComplete(c, x, absent)) {
        const t = subjectTotal(c, x, absent) ?? 0
        subjectTotals[sub.id] = t
        overall += t
      } else {
        subjectTotals[sub.id] = null
        allDone = false
        missing.push({ studentId: st.id, name: st.full_name, subject: sub.name, what: c === null && x === null ? 'both scores' : c === null ? 'class score' : 'exam score' })
      }
    }
    overall = round2(overall)
    return {
      studentId: st.id,
      name: st.full_name,
      subjectTotals,
      overall,
      average: allDone && subjects.length > 0 ? round2(overall / subjects.length) : null,
      position: null,
    }
  })
  // Rule G7: positions only when every student has every subject.
  const complete = missing.length === 0 && students.length > 0 && subjects.length > 0
  if (complete) {
    const ranks = rankWithTies(rows.map((r) => r.overall))
    rows.forEach((r, i) => { r.position = ranks[i] })
  }
  return { rows, missing, complete }
}

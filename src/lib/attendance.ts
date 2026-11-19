import { addDays, mondayOf } from './weeks'

// Business rules A4 and A5 from the build plan.
// Staff enter only "days absent" for the week; everything else is calculated.

export function daysPresent(schoolDays: number, daysAbsent: number): number {
  if (!Number.isInteger(schoolDays) || schoolDays < 0) {
    throw new Error('School days must be a whole number, zero or more')
  }
  if (!Number.isInteger(daysAbsent) || daysAbsent < 0) {
    throw new Error('Days absent must be a whole number, zero or more')
  }
  if (daysAbsent > schoolDays) {
    throw new Error('Days absent cannot be more than school days')
  }
  return schoolDays - daysAbsent
}

// ---------------------------------------------------------------------------
// T11: term attendance rates (rules A6, A7) and weeks not yet recorded.
// ---------------------------------------------------------------------------

export type Totals = { class_id: string; student_id: string; weeks: number; school_days: number; days_absent: number }
export type Rate = { schoolDays: number; daysPresent: number; rate: number | null } // rate in percent, null when nothing is recorded

// Rate = total days present / total school days x 100, over the recorded weeks only.
export function rateOf(schoolDays: number, daysAbsent: number): Rate {
  const daysPresent = schoolDays - daysAbsent
  return { schoolDays, daysPresent, rate: schoolDays > 0 ? Math.round((daysPresent / schoolDays) * 1000) / 10 : null }
}

function add(rows: Totals[]): Rate {
  return rateOf(rows.reduce((a, r) => a + r.school_days, 0), rows.reduce((a, r) => a + r.days_absent, 0))
}

export function studentRate(rows: Totals[], studentId: string): Rate {
  return add(rows.filter((r) => r.student_id === studentId))
}
export function classRate(rows: Totals[], classId: string): Rate {
  return add(rows.filter((r) => r.class_id === classId))
}
export function schoolRate(rows: Totals[]): Rate {
  return add(rows)
}

// Mondays of the weeks that should have been recorded by `today`: the week's Friday falls
// inside the term and has already come. (A week still in progress is not "missing" yet.)
export function weeksDue(term: { start_date: string; end_date: string }, today: string): string[] {
  const out: string[] = []
  for (let monday = mondayOf(term.start_date); ; monday = addDays(monday, 7)) {
    const friday = addDays(monday, 4)
    if (friday > term.end_date || friday > today) break
    if (friday >= term.start_date) out.push(monday)
  }
  return out
}

export function weeksNotRecorded(due: string[], recorded: string[]): string[] {
  const have = new Set(recorded)
  return due.filter((w) => !have.has(w))
}

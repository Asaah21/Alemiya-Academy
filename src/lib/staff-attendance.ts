// Daily staff attendance (rules ST1 to ST5).
import { addDays } from './weeks'

export type StaffStatus = 'present' | 'absent' | 'late' | 'on_leave'
export const STAFF_STATUSES: { value: StaffStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'on_leave', label: 'On leave' },
]

export const isWeekend = (iso: string): boolean => {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 0 || dow === 6
}

// School days (Monday to Friday, not marked as a holiday) from the start of the term up to today
// or the end of the term, whichever comes first.
export function schoolDaysUpTo(
  term: { start_date: string; end_date: string },
  today: string,
  nonSchoolDays: string[],
): string[] {
  const skip = new Set(nonSchoolDays)
  const last = today < term.end_date ? today : term.end_date
  const out: string[] = []
  for (let d = term.start_date; d <= last; d = addDays(d, 1)) {
    if (!isWeekend(d) && !skip.has(d)) out.push(d)
  }
  return out
}

// Rule ST3: a school day with no saved entry is "not recorded".
export function daysNotRecorded(due: string[], recorded: string[]): string[] {
  const have = new Set(recorded)
  return due.filter((d) => !have.has(d))
}

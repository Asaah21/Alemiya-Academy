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

// ---------------------------------------------------------------------------
// T35: term summary per staff member (rules ST5, ST6)
// ---------------------------------------------------------------------------
export type StaffCounts = { staff_id: string; present: number; late: number; absent: number; on_leave: number }

export type StaffSummaryRow = {
  staff_id: string
  name: string
  daysRecorded: number
  present: number // includes late (rule ST5)
  late: number // shown separately as well
  absent: number
  onLeave: number // not an absence, left out of the rate
  rate: number | null // present / (present + absent), percent, null when no days count
}

// Late counts as present and is also counted on its own. On leave is not an absence and is left out of the rate.
export function summariseStaff(counts: StaffCounts[], people: { id: string; full_name: string }[]): StaffSummaryRow[] {
  const by = new Map(counts.map((c) => [c.staff_id, c]))
  return people
    .filter((p) => by.has(p.id))
    .map((p) => {
      const c = by.get(p.id)!
      const present = c.present + c.late
      const counted = present + c.absent
      return {
        staff_id: p.id,
        name: p.full_name,
        daysRecorded: counted + c.on_leave,
        present,
        late: c.late,
        absent: c.absent,
        onLeave: c.on_leave,
        rate: counted > 0 ? Math.round((present / counted) * 1000) / 10 : null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const SUMMARY_HEADINGS = ['Name', 'Days recorded', 'Present (incl. late)', 'Late', 'Absent', 'On leave', 'Attendance %']
export function summaryTable(rows: StaffSummaryRow[]): (string | number)[][] {
  return rows.map((r) => [r.name, r.daysRecorded, r.present, r.late, r.absent, r.onLeave, r.rate === null ? '' : r.rate])
}

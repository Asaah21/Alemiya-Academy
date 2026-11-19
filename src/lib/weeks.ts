// Week helpers for the Weekly Attendance screen. Dates are plain "YYYY-MM-DD" text.
const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const toIso = (dt: Date) => dt.toISOString().slice(0, 10)

export function addDays(iso: string, days: number): string {
  const dt = toDate(iso)
  dt.setUTCDate(dt.getUTCDate() + days)
  return toIso(dt)
}

// The Monday of the week that contains the given date (Sunday belongs to the week before).
export function mondayOf(iso: string): string {
  const dow = toDate(iso).getUTCDay() // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow)
}

export function isMonday(iso: string): boolean {
  return toDate(iso).getUTCDay() === 1
}

// "Mon 9 Nov to Fri 13 Nov 2026"
export function weekLabel(monday: string): string {
  const f = (iso: string, withYear = false) =>
    toDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  return `${f(monday)} to ${f(addDays(monday, 4), true)}`
}

// Rule A4: no student can be absent more days than the week has.
export function checkWeek(schoolDays: number, absences: Record<string, number>): { ok: true } | { ok: false; error: string; studentIds: string[] } {
  if (!Number.isInteger(schoolDays) || schoolDays < 0 || schoolDays > 7) {
    return { ok: false, error: 'School days must be a whole number from 0 to 7.', studentIds: [] }
  }
  const bad = Object.entries(absences).filter(([, d]) => !Number.isInteger(d) || d < 0 || d > schoolDays).map(([id]) => id)
  if (bad.length) {
    return { ok: false, error: `Days absent cannot be more than the ${schoolDays} school days. Fix the marked students.`, studentIds: bad }
  }
  return { ok: true }
}

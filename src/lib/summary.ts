// Summary reports (T25): attendance, fees and results per class, filtered by class and gender.
// Each report returns headings and rows ONCE; the screen shows them and the Excel file writes the same ones,
// so the two can never disagree.
import { rateOf, type Totals } from './attendance'
import { totalDue, type BalanceRow } from './balances'

export type Cell = string | number
export type Table = { headings: string[]; rows: Cell[][]; total: Cell[] }
export type StudentInfo = { id: string; class_id: string | null; gender: 'male' | 'female'; status?: string }
export type Filter = { classId: string; gender: 'all' | 'male' | 'female' }
export type ClassInfo = { id: string; name: string }

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

// The ids of active students who pass the filter.
export function allowedIds(students: StudentInfo[], f: Filter): Set<string> {
  return new Set(students.filter((s) => (s.status ?? 'active') === 'active' && (!f.classId || s.class_id === f.classId) && (f.gender === 'all' || s.gender === f.gender)).map((s) => s.id))
}

function visibleClasses(classes: ClassInfo[], f: Filter): ClassInfo[] {
  return classes.filter((c) => !f.classId || c.id === f.classId)
}

// ---------- Attendance ----------
export const ATTENDANCE_HEADINGS = ['Class', 'Students', 'School days recorded', 'Days present', 'Days absent', 'Attendance rate (%)']

export function attendanceSummary(totals: Totals[], students: StudentInfo[], classes: ClassInfo[], f: Filter): Table {
  const ok = allowedIds(students, f)
  const mine = totals.filter((t) => ok.has(t.student_id))
  const line = (name: string, rows: Totals[]): Cell[] => {
    const days = rows.reduce((a, r) => a + Number(r.school_days), 0)
    const absent = rows.reduce((a, r) => a + Number(r.days_absent), 0)
    const rate = rateOf(days, absent)
    return [name, new Set(rows.map((r) => r.student_id)).size, days, rate.daysPresent, absent, rate.rate ?? '']
  }
  const rows = visibleClasses(classes, f).map((c) => line(c.name, mine.filter((t) => t.class_id === c.id))).filter((r) => r[2] !== 0)
  return { headings: ATTENDANCE_HEADINGS, rows, total: line('School', mine.filter((t) => rows.some((r) => r[0] === classes.find((c) => c.id === t.class_id)?.name))) }
}

// ---------- Fees ----------
export const FEES_HEADINGS = ['Class', 'Students', 'Fees due', 'Collected', 'Balance this term', 'Arrears from earlier terms', 'Total still owed', 'Students owing', 'Collected (%)']

export function feesSummary(balances: BalanceRow[], students: StudentInfo[], classes: ClassInfo[], f: Filter): Table {
  const ok = allowedIds(students, f)
  const mine = balances.filter((b) => ok.has(b.student_id))
  const line = (name: string, rows: BalanceRow[]): Cell[] => {
    const owed = r2(rows.reduce((a, r) => a + r.owed, 0))
    const paid = r2(rows.reduce((a, r) => a + r.paid, 0))
    const arrears = r2(rows.reduce((a, r) => a + Math.max(r.arrears, 0), 0))
    return [name, rows.length, owed, paid, r2(rows.reduce((a, r) => a + Math.max(r.balance, 0), 0)), arrears, r2(rows.reduce((a, r) => a + totalDue(r), 0)),
      rows.filter((r) => totalDue(r) > 0).length, owed > 0 ? r1((Math.min(paid, owed) / owed) * 100) : '']
  }
  const rows = visibleClasses(classes, f).map((c) => line(c.name, mine.filter((b) => b.class_id === c.id))).filter((r) => (r[1] as number) > 0)
  return { headings: FEES_HEADINGS, rows, total: line('School', mine) }
}

// ---------- Results ----------
export type ResultRow = { student_id: string; class_id: string; subjects_expected: number; subjects_scored: number; overall: number }
export const RESULTS_HEADINGS = ['Class', 'Students', 'Results complete', 'Results incomplete', 'Class average', 'Highest average', 'Lowest average']

const complete = (r: ResultRow) => r.subjects_expected > 0 && r.subjects_scored === r.subjects_expected
// A student's average = overall total / number of subjects (rule G5). Only complete results are ranked or averaged.
const average = (r: ResultRow) => r.overall / r.subjects_expected

export function resultsSummary(results: ResultRow[], students: StudentInfo[], classes: ClassInfo[], f: Filter): Table {
  const ok = allowedIds(students, f)
  const mine = results.filter((r) => ok.has(r.student_id))
  const line = (name: string, rows: ResultRow[]): Cell[] => {
    const done = rows.filter(complete)
    const avgs = done.map(average)
    return [name, rows.length, done.length, rows.length - done.length,
      avgs.length ? r1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : '', avgs.length ? r1(Math.max(...avgs)) : '', avgs.length ? r1(Math.min(...avgs)) : '']
  }
  const rows = visibleClasses(classes, f).map((c) => line(c.name, mine.filter((r) => r.class_id === c.id))).filter((r) => (r[1] as number) > 0)
  return { headings: RESULTS_HEADINGS, rows, total: line('School', mine) }
}

// What goes into the Excel file: exactly the headings, rows and total shown on screen.
export const sheetRows = (t: Table): Cell[][] => [t.headings, ...t.rows, t.total]

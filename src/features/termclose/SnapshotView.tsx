import { useMemo, useState } from 'react'
import type { Totals } from '../../lib/attendance'
import type { BalanceRow } from '../../lib/balances'
import { summariseStaff, summaryTable, SUMMARY_HEADINGS, type StaffCounts } from '../../lib/staff-attendance'
import { attendanceSummary, feesSummary, resultsSummary, type Cell, type ResultRow, type StudentInfo, type Table } from '../../lib/summary'
import { turnoverLines, type TurnoverRow } from '../../lib/turnover'

export type SnapshotData = {
  term: { id: string; name: string; year: string; start_date: string; end_date: string }
  classes: { id: string; name: string }[]
  students: { id: string; full_name: string; admission_no: string; gender: 'male' | 'female'; class_id: string | null }[]
  attendance: Totals[]
  staff: { id: string; full_name: string }[]
  staff_attendance: StaffCounts[]
  results: ResultRow[]
  fees: BalanceRow[]
  turnover: TurnoverRow[]
}

const all = { classId: '', gender: 'all' as const }

function Grid({ headings, rows, total }: { headings: string[]; rows: Cell[][]; total?: Cell[] }) {
  if (rows.length === 0) return <p className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">Nothing was recorded.</p>
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full min-w-[28rem] text-sm">
        <thead className="bg-slate-100"><tr>{headings.map((h, i) => <th key={h} className={`p-2 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, n) => <tr key={n} className="border-t border-slate-200">{r.map((v, i) => <td key={i} className={`p-2 ${i === 0 ? 'font-medium' : 'text-right'}`}>{v}</td>)}</tr>)}</tbody>
        {total && <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold"><tr>{total.map((v, i) => <td key={i} className={`p-2 ${i === 0 ? '' : 'text-right'}`}>{v}</td>)}</tr></tfoot>}
      </table>
    </div>
  )
}

// The numbers exactly as they stood when the term was closed. Uses the same sums as the live reports.
export default function SnapshotView({ data }: { data: SnapshotData }) {
  const [open, setOpen] = useState<string>('attendance')
  const students: StudentInfo[] = data.students
  const t: Record<string, Table> = useMemo(() => ({
    attendance: attendanceSummary(data.attendance, students, data.classes, all),
    fees: feesSummary(data.fees, students, data.classes, all),
    results: resultsSummary(data.results, students, data.classes, all),
  }), [data, students])
  const staff = useMemo(() => summaryTable(summariseStaff(data.staff_attendance, data.staff)), [data])
  const turn = useMemo(() => turnoverLines(data.turnover, data.classes.map((c) => c.id), 'all'), [data])
  const className = new Map(data.classes.map((c) => [c.id, c.name]))
  const sections: [string, string][] = [['attendance', 'Student attendance'], ['staff', 'Staff attendance'], ['results', 'Results'], ['fees', 'Fees'], ['turnover', 'Enrolment turnover'], ['classes', 'Class lists']]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {sections.map(([k, label]) => <button key={k} onClick={() => setOpen(k)} className={`rounded-lg px-3 py-2 text-sm font-medium ${open === k ? 'bg-brand text-white' : 'bg-white shadow-sm'}`}>{label}</button>)}
      </div>
      {open === 'attendance' && <Grid {...t.attendance} />}
      {open === 'staff' && <Grid headings={SUMMARY_HEADINGS} rows={staff} />}
      {open === 'results' && <Grid {...t.results} />}
      {open === 'fees' && <Grid {...t.fees} />}
      {open === 'turnover' && (
        <Grid
          headings={['Class', 'Opening', 'New', 'Transferred in', 'Transferred out', 'Withdrawn', 'Graduated', 'Closing', 'Net']}
          rows={turn.lines.filter((l) => l.opening || l.closing || l.new_admissions || l.transfers_in || l.transfers_out || l.withdrawn || l.graduated).map((l) => [className.get(l.class_id) ?? '', l.opening, l.new_admissions, l.transfers_in, l.transfers_out, l.withdrawn, l.graduated, l.closing, l.net])}
          total={['School', turn.total.opening, turn.total.new_admissions, turn.total.transfers_in, turn.total.transfers_out, turn.total.withdrawn, turn.total.graduated, turn.total.closing, turn.total.net]}
        />
      )}
      {open === 'classes' && (
        <div className="flex flex-col gap-2">
          {data.classes.map((c) => {
            const list = data.students.filter((s) => s.class_id === c.id)
            return list.length === 0 ? null : (
              <details key={c.id} className="rounded-xl bg-white p-3 shadow-sm">
                <summary className="cursor-pointer font-medium">{c.name} ({list.length})</summary>
                <ol className="mt-2 list-decimal pl-6 text-sm">{list.map((s) => <li key={s.id}>{s.full_name} <span className="text-slate-500">{s.admission_no}</span></li>)}</ol>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}

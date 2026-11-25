import { Link } from 'react-router-dom'

// Admin only. The summary reports (T25) share one screen with filters and Excel export.
export default function Reports() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
      <div className="flex flex-col gap-3">
        <Link to="/reports/turnover" className="rounded-xl border border-slate-200 bg-white p-4 font-medium shadow-sm">Enrolment turnover: opening, joins, leavers, closing</Link>
        <Link to="/reports/summary" className="rounded-xl border border-slate-200 bg-white p-4 font-medium shadow-sm">Summary reports: attendance, fees, results (filter, Excel, print)</Link>
        <Link to="/staff-attendance/summary" className="rounded-xl border border-slate-200 bg-white p-4 font-medium shadow-sm">Staff attendance summary</Link>
        <Link to="/attendance/summary" className="rounded-xl border border-slate-200 bg-white p-4 font-medium shadow-sm">Student attendance summary</Link>
        <Link to="/fees/balances" className="rounded-xl border border-slate-200 bg-white p-4 font-medium shadow-sm">Fee balances and arrears</Link>
        <Link to="/fees/cash" className="rounded-xl border border-slate-200 bg-white p-4 font-medium shadow-sm">Daily cash</Link>
        <Link to="/scores/results" className="rounded-xl border border-slate-200 bg-white p-4 font-medium shadow-sm">Class results and positions</Link>
      </div>
    </div>
  )
}

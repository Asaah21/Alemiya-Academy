import { Link } from 'react-router-dom'

// Admin only. T25 adds the attendance, fees and results summaries here.
export default function Reports() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="flex flex-col gap-3">
        <Link to="/reports/turnover" className="rounded-xl bg-white p-4 font-medium shadow-sm">Enrolment turnover: opening, joins, leavers, closing</Link>
        <Link to="/staff-attendance/summary" className="rounded-xl bg-white p-4 font-medium shadow-sm">Staff attendance summary</Link>
        <Link to="/attendance/summary" className="rounded-xl bg-white p-4 font-medium shadow-sm">Student attendance summary</Link>
        <Link to="/fees/balances" className="rounded-xl bg-white p-4 font-medium shadow-sm">Fee balances and arrears</Link>
        <Link to="/fees/cash" className="rounded-xl bg-white p-4 font-medium shadow-sm">Daily cash</Link>
        <Link to="/scores/results" className="rounded-xl bg-white p-4 font-medium shadow-sm">Class results and positions</Link>
      </div>
    </div>
  )
}

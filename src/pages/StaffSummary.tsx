import writeXlsxFile from 'write-excel-file/browser'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchool } from '../features/school/SchoolProvider'
import { summariseStaff, summaryTable, SUMMARY_HEADINGS, type StaffCounts, type StaffSummaryRow } from '../lib/staff-attendance'
import { supabase } from '../lib/supabase'

type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'

export default function StaffSummary() {
  const { currentTerm, schoolName } = useSchool()
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [rows, setRows] = useState<StaffSummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    supabase!.from('terms').select('id, name, academic_years(name)').order('start_date', { ascending: false })
      .then(({ data }) => setTerms((data as unknown as Term[]) ?? []))
  }, [])
  useEffect(() => {
    if (!termId && terms.length) setTermId(currentTerm?.id ?? terms[0].id)
  }, [terms, currentTerm, termId])

  useEffect(() => {
    if (!termId) return
    setLoading(true)
    setError(false)
    Promise.all([
      supabase!.rpc('staff_attendance_totals', { p_term: termId }),
      supabase!.from('staff').select('id, full_name'),
    ]).then(([t, s]) => {
      if (t.error || s.error) setError(true)
      const counts = ((t.data ?? []) as StaffCounts[]).map((r) => ({ ...r, present: Number(r.present), late: Number(r.late), absent: Number(r.absent), on_leave: Number(r.on_leave) }))
      setRows(summariseStaff(counts, s.data ?? []))
      setLoading(false)
    })
  }, [termId])

  const term = terms.find((t) => t.id === termId)
  const title = term ? `Staff attendance, ${term.name}, ${yearName(term)}` : 'Staff attendance'

  async function exportExcel() {
    const head = SUMMARY_HEADINGS.map((h) => ({ value: h, fontWeight: 'bold' as const }))
    const body = summaryTable(rows).map((r) => r.map((v) => (v === '' ? null : { value: v })))
    await writeXlsxFile([head, ...body] as never, { sheet: 'Staff attendance' } as never).toFile(`${title.replace(/[^A-Za-z0-9]+/g, '-')}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Staff attendance summary</h1>
        <Link to="/staff-attendance" className="text-sm underline">Take attendance</Link>
      </div>

      <div className="hidden print:block">
        <p className="text-lg font-bold">{schoolName}</p>
        <p>{title}</p>
      </div>

      <select value={termId} onChange={(e) => setTermId(e.target.value)} className={`${input} print:hidden`} aria-label="Term">
        {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
      </select>

      {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Could not load the summary. Please try again.</p>}
      {loading && <p className="text-slate-600">Loading…</p>}

      {!loading && !error && (
        rows.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No staff attendance has been saved for this term yet.</p>
        ) : (
          <>
            <div className="flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="rounded-lg border border-slate-300 px-4 py-3 font-medium">Print</button>
              <button onClick={exportExcel} className="rounded-lg border border-slate-300 px-4 py-3 font-medium">Download Excel</button>
            </div>
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm print:shadow-none">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="bg-slate-100 print:bg-transparent">
                  <tr>{SUMMARY_HEADINGS.map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.staff_id} className="border-t border-slate-200">
                      <td className="p-3 font-medium">{r.name}</td>
                      <td className="p-3">{r.daysRecorded}</td>
                      <td className="p-3">{r.present}</td>
                      <td className="p-3">{r.late}</td>
                      <td className="p-3">{r.absent}</td>
                      <td className="p-3">{r.onLeave}</td>
                      <td className="p-3 font-semibold">{r.rate === null ? 'n/a' : `${r.rate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Late counts as present and is also shown on its own. On-leave days are not absences and are left out of the percentage. Holidays and days not saved are not counted.
            </p>
          </>
        )
      )}
    </div>
  )
}

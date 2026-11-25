import writeXlsxFile from 'write-excel-file/browser'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchool } from '../features/school/SchoolProvider'
import type { Totals } from '../lib/attendance'
import type { BalanceRow } from '../lib/balances'
import { attendanceSummary, feesSummary, resultsSummary, sheetRows, type Filter, type ResultRow, type StudentInfo, type Table } from '../lib/summary'
import { supabase } from '../lib/supabase'

type Kind = 'attendance' | 'fees' | 'results'
type Term = { id: string; name: string; academic_year_id: string; academic_years: { name: string } | { name: string }[] | null }
const yearOf = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const TITLES: Record<Kind, string> = { attendance: 'Student attendance', fees: 'Fees', results: 'Results' }
const num = (v: unknown) => Number(v ?? 0)

// The database sends at most 1000 rows a request, so a long list is fetched in pages.
async function allStudents(): Promise<StudentInfo[]> {
  const out: StudentInfo[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase!.from('students').select('id, class_id, gender, status').eq('status', 'active').order('id').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as StudentInfo[]))
    if (!data || data.length < 1000) return out
  }
}

export default function SummaryReports() {
  const { currentTerm, schoolName } = useSchool()
  const [kind, setKind] = useState<Kind>('attendance')
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [yearId, setYearId] = useState('')
  const [termId, setTermId] = useState('')
  const [filter, setFilter] = useState<Filter>({ classId: '', gender: 'all' })
  const [att, setAtt] = useState<Totals[]>([])
  const [fees, setFees] = useState<BalanceRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase!.from('classes').select('id, name').order('level_order'),
      supabase!.from('terms').select('id, name, academic_year_id, academic_years(name)').order('start_date', { ascending: false }),
      allStudents(),
    ]).then(([c, t, s]) => { setClasses(c.data ?? []); setTerms((t.data as unknown as Term[]) ?? []); setStudents(s) }).catch(() => setError(true))
  }, [])
  useEffect(() => {
    if (!termId && currentTerm) {
      setTermId(currentTerm.id)
      const t = terms.find((x) => x.id === currentTerm.id)
      if (t) setYearId(t.academic_year_id)
    }
  }, [currentTerm, termId, terms])

  const years = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of terms) m.set(t.academic_year_id, yearOf(t))
    return [...m.entries()]
  }, [terms])
  const termChoices = terms.filter((t) => !yearId || t.academic_year_id === yearId)

  useEffect(() => {
    if (!termId) return
    setLoading(true)
    setError(false)
    const job = kind === 'attendance'
      ? supabase!.rpc('attendance_term_totals', { p_term: termId }).then(({ data, error: e }) => { if (e) throw e; setAtt(((data ?? []) as Record<string, unknown>[]).map((r) => ({ class_id: String(r.class_id), student_id: String(r.student_id), weeks: num(r.weeks), school_days: num(r.school_days), days_absent: num(r.days_absent) }))) })
      : kind === 'fees'
        ? supabase!.rpc('fee_balances', { p_term: termId }).then(({ data, error: e }) => { if (e) throw e; setFees(((data ?? []) as Record<string, unknown>[]).map((r) => ({ student_id: String(r.student_id), admission_no: String(r.admission_no), full_name: String(r.full_name), class_id: (r.class_id as string) ?? null, owed: num(r.owed), paid: num(r.paid), balance: num(r.balance), arrears: num(r.arrears) }))) })
        : supabase!.rpc('results_summary', { p_term: termId }).then(({ data, error: e }) => { if (e) throw e; setResults(((data ?? []) as Record<string, unknown>[]).map((r) => ({ student_id: String(r.student_id), class_id: String(r.class_id), subjects_expected: num(r.subjects_expected), subjects_scored: num(r.subjects_scored), overall: num(r.overall) }))) })
    Promise.resolve(job).catch(() => setError(true)).finally(() => setLoading(false))
  }, [kind, termId])

  const table: Table = useMemo(() => (
    kind === 'attendance' ? attendanceSummary(att, students, classes, filter)
      : kind === 'fees' ? feesSummary(fees, students, classes, filter)
        : resultsSummary(results, students, classes, filter)
  ), [kind, att, fees, results, students, classes, filter])

  const term = terms.find((t) => t.id === termId)
  const termLabel = term ? `${term.name}, ${yearOf(term)}` : ''
  const genderLabel = filter.gender === 'all' ? 'Boys and girls' : filter.gender === 'male' ? 'Boys' : 'Girls'
  const classLabel = filter.classId ? classes.find((c) => c.id === filter.classId)?.name : 'All classes'

  async function exportExcel() {
    const rows = sheetRows(table).map((r, i) => r.map((v) => ({ value: v === '' ? undefined : v, fontWeight: i === 0 || r === table.total ? 'bold' : undefined })))
    await writeXlsxFile(rows as never, { sheet: TITLES[kind] } as never).toFile(`${TITLES[kind]}-${termLabel}-${classLabel}-${genderLabel}.xlsx`.replace(/[^A-Za-z0-9.]+/g, '-'))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Summary reports</h1>
        <Link to="/reports" className="text-sm underline">Reports</Link>
      </div>
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex gap-2">
          {(['attendance', 'fees', 'results'] as Kind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`flex-1 rounded-lg p-3 font-medium ${kind === k ? 'bg-brand text-white' : 'bg-white shadow-sm'}`}>{TITLES[k]}</button>
          ))}
        </div>
        <select value={yearId} onChange={(e) => { setYearId(e.target.value); setTermId('') }} className={input} aria-label="Year">
          <option value="">All years</option>
          {years.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
          <option value="">Choose the term</option>
          {termChoices.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearOf(t)}</option>)}
        </select>
        <select value={filter.classId} onChange={(e) => setFilter({ ...filter, classId: e.target.value })} className={input} aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filter.gender} onChange={(e) => setFilter({ ...filter, gender: e.target.value as Filter['gender'] })} className={input} aria-label="Gender">
          <option value="all">Boys and girls</option>
          <option value="male">Boys only</option>
          <option value="female">Girls only</option>
        </select>
        {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Could not load the report. Please try again.</p>}
        {loading && <p className="text-slate-600">Loading…</p>}
      </div>

      {termId && !loading && !error && (
        <>
          <div className="hidden print:block"><h1 className="text-xl font-bold">{schoolName}: {TITLES[kind].toLowerCase()} summary</h1><p>{termLabel} · {classLabel} · {genderLabel}</p></div>
          {table.rows.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">Nothing to show for these choices.</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-slate-100">
                  <tr>{table.headings.map((h, i) => <th key={h} className={`p-2 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => <tr key={String(r[0])} className="border-t border-slate-200">{r.map((v, i) => <td key={i} className={`p-2 ${i === 0 ? 'font-medium' : 'text-right'}`}>{v}</td>)}</tr>)}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <tr>{table.total.map((v, i) => <td key={i} className={`p-2 ${i === 0 ? '' : 'text-right'}`}>{v}</td>)}</tr>
                </tfoot>
              </table>
            </div>
          )}
          {kind === 'attendance' && <p className="text-xs text-slate-500">Only weeks that were recorded are counted. Rate = days present ÷ school days × 100.</p>}
          {kind === 'fees' && <p className="text-xs text-slate-500">Arrears are unpaid fees from earlier terms, from the student's current class. Voided payments are not counted.</p>}
          {kind === 'results' && <p className="text-xs text-slate-500">Averages use complete results only. A student's average = overall total ÷ number of subjects. Classes without scores are not listed.</p>}
          <div className="flex gap-2 print:hidden">
            <button onClick={exportExcel} disabled={table.rows.length === 0} className="flex-1 rounded-lg border border-slate-300 p-3 font-medium disabled:opacity-50">Export to Excel</button>
            <button onClick={() => window.print()} className="flex-1 rounded-lg border border-slate-300 p-3 font-medium">Print</button>
          </div>
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchool } from '../features/school/SchoolProvider'
import { balanceTotals, byDebt, owingOnly, totalDue, type BalanceRow } from '../lib/balances'
import { formatMoney } from '../lib/fees'
import { supabase } from '../lib/supabase'

type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'

export default function Balances() {
  const { currentTerm, schoolName } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [owing, setOwing] = useState(true)
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase!.from('classes').select('id, name').order('level_order'),
      supabase!.from('terms').select('id, name, academic_years(name)').order('start_date', { ascending: false }),
    ]).then(([c, t]) => { setClasses(c.data ?? []); setTerms((t.data as unknown as Term[]) ?? []) })
  }, [])
  useEffect(() => { if (!termId && currentTerm) setTermId(currentTerm.id) }, [currentTerm, termId])

  useEffect(() => {
    if (!termId) return
    setLoading(true)
    setError(false)
    supabase!.rpc('fee_balances', { p_term: termId, p_class: classId || null }).then(({ data, error: e }) => {
      if (e) setError(true)
      setRows(((data ?? []) as Record<string, unknown>[]).map((r) => ({
        student_id: String(r.student_id), admission_no: String(r.admission_no), full_name: String(r.full_name), class_id: (r.class_id as string) ?? null,
        owed: Number(r.owed), paid: Number(r.paid), balance: Number(r.balance), arrears: Number(r.arrears),
      })))
      setLoading(false)
    })
  }, [termId, classId])

  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])
  const totals = useMemo(() => balanceTotals(rows), [rows])
  const shown = useMemo(() => byDebt(owing ? owingOnly(rows) : rows), [rows, owing])
  const termName = (() => { const t = terms.find((x) => x.id === termId); return t ? `${t.name}, ${yearName(t)}` : '' })()
  const classLabel = classId ? className.get(classId) : 'All classes'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Fee balances</h1>
        <Link to="/fees" className="text-sm underline">Record payment</Link>
      </div>
      <div className="flex flex-col gap-4 print:hidden">
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
          <option value="">Choose the term</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
        </select>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-3 text-base"><input type="checkbox" checked={owing} onChange={(e) => setOwing(e.target.checked)} className="h-5 w-5" /> Only students who still owe</label>
        {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Could not load the balances. Please try again.</p>}
        {loading && <p className="text-slate-600">Loading…</p>}
      </div>

      {termId && !loading && !error && (
        <>
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">{schoolName}: fee balances</h1>
            <p>{termName} · {classLabel}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-600">Fees due this term</p><p className="font-bold">{formatMoney(totals.owed)}</p></div>
            <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-600">Collected</p><p className="font-bold">{formatMoney(totals.paid)}</p></div>
            <div className="rounded-xl bg-amber-100 p-3 shadow-sm"><p className="text-xs text-slate-600">Still to collect (with arrears)</p><p className="font-bold">{formatMoney(totals.due)}</p></div>
            <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-600">Collected so far</p><p className="font-bold">{totals.collectionRate === null ? '–' : `${totals.collectionRate}%`}</p></div>
          </div>
          <p className="text-sm text-slate-600">{totals.owing} of {totals.students} students still owe.</p>
          {shown.length === 0 ? <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">{rows.length === 0 ? 'No active students.' : 'Nobody owes anything. Well done!'}</p> : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="bg-slate-100"><tr><th className="p-3">Student</th><th className="p-3">Class</th><th className="p-3">Owed</th><th className="p-3">Paid</th><th className="p-3">Arrears</th><th className="p-3">Still owes</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.student_id} className="border-t border-slate-200">
                      <td className="p-3"><span className="block font-medium">{r.full_name}</span><span className="text-xs text-slate-500">{r.admission_no}</span></td>
                      <td className="p-3">{r.class_id ? className.get(r.class_id) : ''}</td>
                      <td className="p-3">{formatMoney(r.owed)}</td>
                      <td className="p-3">{formatMoney(r.paid)}</td>
                      <td className="p-3">{r.arrears > 0 ? formatMoney(r.arrears) : '–'}</td>
                      <td className="p-3 font-bold">{formatMoney(totalDue(r))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">Arrears are unpaid fees from earlier terms, worked out from the student's current class. Voided payments are not counted.</p>
          <button onClick={() => window.print()} className="rounded-lg border border-slate-300 p-3 font-medium print:hidden">Print this list</button>
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchool } from '../features/school/SchoolProvider'
import { receiptDate } from '../lib/payments'
import { MOVEMENT_LABELS } from '../lib/students'
import { isQuiet, turnoverLines, type TurnoverRow } from '../lib/turnover'
import { supabase } from '../lib/supabase'

type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }
type Who = { student_id: string; full_name: string; admission_no: string; gender: 'male' | 'female'; class_id: string; movement: string; moved_on: string; reason: string | null }
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const num = (v: unknown) => Number(v ?? 0)

export default function Turnover() {
  const { currentTerm, schoolName } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all')
  const [rows, setRows] = useState<TurnoverRow[]>([])
  const [who, setWho] = useState<Who[]>([])
  const [classId, setClassId] = useState('')
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
    setClassId('')
    Promise.all([supabase!.rpc('enrolment_turnover', { p_term: termId }), supabase!.rpc('turnover_students', { p_term: termId })]).then(([a, b]) => {
      if (a.error || b.error) setError(true)
      setRows(((a.data ?? []) as Record<string, unknown>[]).map((r) => ({
        class_id: String(r.class_id), gender: r.gender as 'male' | 'female', opening: num(r.opening), new_admissions: num(r.new_admissions), transfers_in: num(r.transfers_in),
        transfers_out: num(r.transfers_out), withdrawn: num(r.withdrawn), graduated: num(r.graduated), promoted_in: num(r.promoted_in), promoted_out: num(r.promoted_out), closing: num(r.closing),
      })))
      setWho((b.data ?? []) as Who[])
      setLoading(false)
    })
  }, [termId])

  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])
  const { lines, total } = useMemo(() => turnoverLines(rows, classes.map((c) => c.id), gender), [rows, classes, gender])
  const showPromo = lines.some((l) => l.promoted_in > 0 || l.promoted_out > 0)
  const shownLines = lines.filter((l) => !isQuiet(l))
  const names = who.filter((w) => (!classId || w.class_id === classId) && (gender === 'all' || w.gender === gender))
  const termName = (() => { const t = terms.find((x) => x.id === termId); return t ? `${t.name}, ${yearName(t)}` : '' })()
  const cell = 'p-2 text-right'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-extrabold text-brand">Enrolment turnover</h1>
        <Link to="/reports" className="text-sm underline">Reports</Link>
      </div>
      <div className="flex flex-col gap-3 print:hidden">
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
          <option value="">Choose the term</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value as 'all' | 'male' | 'female')} className={input} aria-label="Gender">
          <option value="all">Boys and girls</option>
          <option value="male">Boys only</option>
          <option value="female">Girls only</option>
        </select>
        {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Could not load the report. Please try again.</p>}
        {loading && <p className="text-slate-600">Loading…</p>}
      </div>

      {termId && !loading && !error && (
        <>
          <div className="hidden print:block"><h1 className="text-xl font-bold">{schoolName}: enrolment turnover</h1><p>{termName} · {gender === 'all' ? 'Boys and girls' : gender === 'male' ? 'Boys' : 'Girls'}</p></div>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-slate-100 text-right">
                <tr>
                  <th className="p-2 text-left">Class</th><th className={cell}>Opening</th><th className={cell}>New</th><th className={cell}>Transf. in</th>
                  {showPromo && <th className={cell}>Promoted in</th>}
                  <th className={cell}>Transf. out</th><th className={cell}>Withdrawn</th><th className={cell}>Graduated</th>
                  {showPromo && <th className={cell}>Promoted out</th>}
                  <th className={cell}>Closing</th><th className={cell}>Net</th><th className={cell}>Attrition</th>
                </tr>
              </thead>
              <tbody>
                {shownLines.length === 0 && <tr><td colSpan={12} className="p-4 text-center text-slate-600">No students or movements recorded for this term.</td></tr>}
                {shownLines.map((l) => (
                  <tr key={l.class_id} onClick={() => setClassId(classId === l.class_id ? '' : l.class_id)} className={`cursor-pointer border-t border-slate-200 ${classId === l.class_id ? 'bg-amber-50' : ''}`}>
                    <td className="p-2 font-medium">{className.get(l.class_id)}</td><td className={cell}>{l.opening}</td><td className={cell}>{l.new_admissions}</td><td className={cell}>{l.transfers_in}</td>
                    {showPromo && <td className={cell}>{l.promoted_in}</td>}
                    <td className={cell}>{l.transfers_out}</td><td className={cell}>{l.withdrawn}</td><td className={cell}>{l.graduated}</td>
                    {showPromo && <td className={cell}>{l.promoted_out}</td>}
                    <td className={`${cell} font-bold`}>{l.closing}</td><td className={cell}>{l.net > 0 ? `+${l.net}` : l.net}</td><td className={cell}>{l.attrition === null ? '–' : `${l.attrition}%`}</td>
                  </tr>
                ))}
              </tbody>
              {shownLines.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <tr>
                    <td className="p-2">School</td><td className={cell}>{total.opening}</td><td className={cell}>{total.new_admissions}</td><td className={cell}>{total.transfers_in}</td>
                    {showPromo && <td className={cell}>{total.promoted_in}</td>}
                    <td className={cell}>{total.transfers_out}</td><td className={cell}>{total.withdrawn}</td><td className={cell}>{total.graduated}</td>
                    {showPromo && <td className={cell}>{total.promoted_out}</td>}
                    <td className={cell}>{total.closing}</td><td className={cell}>{total.net > 0 ? `+${total.net}` : total.net}</td><td className={cell}>{total.attrition === null ? '–' : `${total.attrition}%`}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-slate-500">Closing = opening + new + transferred in − transferred out − withdrawn − graduated. Attrition = (transferred out + withdrawn) ÷ opening × 100. Tap a class to list only its students.</p>

          <h2 className="font-semibold">Students behind the numbers{classId ? `: ${className.get(classId)}` : ''}</h2>
          {names.length === 0 ? <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No movements to list.</p> : (
            <ul className="flex flex-col gap-2">
              {names.map((w, i) => (
                <li key={`${w.student_id}${i}`} className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="font-medium">{w.full_name} <span className="text-sm font-normal text-slate-600">({w.gender === 'male' ? 'boy' : 'girl'}, {className.get(w.class_id)})</span></p>
                  <p className="text-sm text-slate-600">{MOVEMENT_LABELS[w.movement] ?? w.movement} · {receiptDate(w.moved_on)}{w.reason ? ` · ${w.reason}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => window.print()} className="rounded-lg border border-slate-300 p-3 font-medium print:hidden">Print</button>
        </>
      )}
    </div>
  )
}

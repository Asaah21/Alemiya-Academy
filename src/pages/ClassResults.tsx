import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PublishPanel from '../features/results/PublishPanel'
import { useSchool } from '../features/school/SchoolProvider'
import { computeClassResults, type ScoreRow } from '../lib/results'
import { supabase } from '../lib/supabase'

type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export default function ClassResults() {
  const { currentTerm } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([])
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase!.from('classes').select('id, name').order('level_order'),
      supabase!.from('terms').select('id, name, academic_years(name)').order('start_date', { ascending: false }),
    ]).then(([c, t]) => {
      setClasses(c.data ?? [])
      setTerms((t.data as unknown as Term[]) ?? [])
    })
  }, [])
  useEffect(() => { if (!termId && currentTerm) setTermId(currentTerm.id) }, [currentTerm, termId])

  useEffect(() => {
    if (!classId || !termId) return
    setLoading(true)
    setError(false)
    ;(async () => {
      const [s, cs] = await Promise.all([
        supabase!.from('students').select('id, full_name').eq('class_id', classId).eq('status', 'active').order('full_name'),
        supabase!.from('class_subjects').select('subjects(id, name)').eq('class_id', classId),
      ])
      const subs = ((cs.data ?? []) as unknown as { subjects: { id: string; name: string } | { id: string; name: string }[] }[])
        .map((r) => (Array.isArray(r.subjects) ? r.subjects[0] : r.subjects))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
      const ids = (s.data ?? []).map((x) => x.id)
      const sc = ids.length
        ? await supabase!.from('scores').select('student_id, subject_id, class_score, exam_score, is_absent').eq('term_id', termId).in('student_id', ids)
        : { data: [], error: null }
      if (s.error || cs.error || sc.error) setError(true)
      setStudents(s.data ?? [])
      setSubjects(subs)
      setScores(((sc.data ?? []) as ScoreRow[]).map((r) => ({ ...r, class_score: num(r.class_score), exam_score: num(r.exam_score) })))
      setLoading(false)
    })()
  }, [classId, termId])

  const results = useMemo(() => computeClassResults(students, subjects, scores), [students, subjects, scores])
  const ordered = useMemo(
    () => [...results.rows].sort((a, b) => (results.complete ? (a.position ?? 0) - (b.position ?? 0) : a.name.localeCompare(b.name))),
    [results],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Class results</h1>
        <Link to="/scores" className="text-sm underline">Enter scores</Link>
      </div>
      <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
        <option value="">Choose the term</option>
        {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
      </select>
      <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
        <option value="">Choose the class</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Could not load the results. Please try again.</p>}
      {loading && <p className="text-slate-600">Loading…</p>}

      {classId && termId && !loading && !error && (
        subjects.length === 0 ? (
          <>
            <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No subjects are set for this class (Setup, Classes). Classes without scores (such as Creche) can still be published below.</p>
            {students.length > 0 && <PublishPanel classId={classId} termId={termId} complete />}
          </>
        )
        : students.length === 0 ? <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">There are no active students in this class.</p>
        : (
          <>
            <PublishPanel classId={classId} termId={termId} complete={results.complete} />
            {results.complete ? (
              <p className="rounded-xl bg-green-100 p-4 text-sm text-green-900">Every student has every subject, so positions are shown. Students with equal totals share a position.</p>
            ) : (
              <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
                <p className="font-medium">Positions cannot be worked out yet. {results.missing.length} score{results.missing.length === 1 ? ' is' : 's are'} missing:</p>
                <ul className="mt-2 list-disc pl-5">
                  {results.missing.slice(0, 40).map((m, i) => <li key={i}>{m.name}: {m.subject} ({m.what})</li>)}
                </ul>
                {results.missing.length > 40 && <p className="mt-1">…and {results.missing.length - 40} more.</p>}
              </div>
            )}
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3">Pos.</th>
                    <th className="p-3">Name</th>
                    {subjects.map((s) => <th key={s.id} className="p-3">{s.name}</th>)}
                    <th className="p-3">Total</th>
                    <th className="p-3">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((r) => (
                    <tr key={r.studentId} className="border-t border-slate-200">
                      <td className="p-3 font-bold">{r.position ?? '–'}</td>
                      <td className="p-3 font-medium">{r.name}</td>
                      {subjects.map((s) => <td key={s.id} className={`p-3 ${r.subjectTotals[s.id] === null ? 'text-amber-700' : ''}`}>{r.subjectTotals[s.id] ?? 'missing'}</td>)}
                      <td className="p-3 font-semibold">{r.overall}</td>
                      <td className="p-3">{r.average ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Total = sum of the subject totals. Average = total ÷ number of subjects. Absent counts as 0.</p>
          </>
        )
      )}
    </div>
  )
}

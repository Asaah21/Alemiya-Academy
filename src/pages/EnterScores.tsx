import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import type { GradeRow } from '../lib/grades'
import { checkSingleScore, gradeFor, markToColumns, savedMark } from '../lib/results'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

type Student = { id: string; full_name: string; admission_no: string }
type Entry = { text: string; absent: boolean }
type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }

const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const show = (n: number | null) => (n === null ? '' : String(n))

export default function EnterScores() {
  const { currentTerm, examMax } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string; scored: boolean }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [scale, setScale] = useState<GradeRow[]>([])
  const [classId, setClassId] = useState('')
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [termId, setTermId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [bad, setBad] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase!.from('classes').select('id, name, scored').order('level_order'),
      supabase!.from('terms').select('id, name, academic_years(name)').order('start_date', { ascending: false }),
      supabase!.from('grade_scale').select('min_score, max_score, grade, remark'),
    ]).then(([c, t, g]) => {
      setClasses(c.data ?? [])
      setTerms((t.data as unknown as Term[]) ?? [])
      setScale(((g.data ?? []) as GradeRow[]).map((r) => ({ ...r, min_score: Number(r.min_score), max_score: Number(r.max_score), remark: r.remark ?? '' })))
    })
  }, [])
  useEffect(() => { if (!termId && currentTerm) setTermId(currentTerm.id) }, [currentTerm, termId])

  useEffect(() => {
    setSubjectId('')
    setSubjects([])
    if (!classId) return
    supabase!.from('class_subjects').select('subjects(id, name)').eq('class_id', classId).then(({ data }) => {
      const list = ((data ?? []) as unknown as { subjects: { id: string; name: string } | { id: string; name: string }[] }[])
        .map((r) => (Array.isArray(r.subjects) ? r.subjects[0] : r.subjects))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
      setSubjects(list)
    })
  }, [classId])

  const load = useCallback(async () => {
    if (!classId || !subjectId || !termId) return setStudents([])
    setLoading(true)
    setMsg(null)
    setBad({})
    const [s, sc] = await Promise.all([
      supabase!.from('students').select('id, full_name, admission_no').eq('class_id', classId).eq('status', 'active').order('full_name'),
      supabase!.from('scores').select('student_id, class_score, exam_score, is_absent').eq('subject_id', subjectId).eq('term_id', termId),
    ])
    const saved = new Map((sc.data ?? []).map((r) => [r.student_id as string, r]))
    const e: Record<string, Entry> = {}
    for (const st of (s.data as Student[]) ?? []) {
      const r = saved.get(st.id)
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
      e[st.id] = { text: show(savedMark(num(r?.class_score), num(r?.exam_score))), absent: r?.is_absent ?? false }
    }
    setStudents((s.data as Student[]) ?? [])
    setEntries(e)
    setLoading(false)
  }, [classId, subjectId, termId])
  useEffect(() => { load() }, [load])

  const cls = classes.find((c) => c.id === classId)
  const checks = useMemo(() => Object.fromEntries(students.map((s) => { const en = entries[s.id] ?? { text: '', absent: false }; return [s.id, checkSingleScore(en.text, en.absent, examMax)] })), [students, entries, examMax])
  const completeCount = students.filter((s) => { const c = checks[s.id]; return c && !c.error && (c.score !== null || entries[s.id]?.absent) }).length

  const set = (id: string, patch: Partial<Entry>) => setEntries({ ...entries, [id]: { ...entries[id], ...patch } })

  async function save() {
    const errs: Record<string, string> = {}
    for (const s of students) if (checks[s.id]?.error) errs[s.id] = checks[s.id].error!
    setBad(errs)
    if (Object.keys(errs).length) return setMsg({ ok: false, text: `Fix the ${Object.keys(errs).length} marked student${Object.keys(errs).length === 1 ? '' : 's'} first. Nothing was saved.` })
    const rows = students.map((s) => ({ student_id: s.id, ...markToColumns(checks[s.id].score), is_absent: entries[s.id].absent }))
    const { error } = await supabase!.rpc('save_scores', { p_class: classId, p_subject: subjectId, p_term: termId, p_rows: rows })
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not save. Please try again.') })
    setMsg({ ok: true, text: `Saved. ${completeCount} of ${students.length} students have complete scores.` })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Enter Scores</h1>
        <Link to="/scores/results" className="text-sm underline">Class results</Link>
      </div>
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        Type each student's score out of {examMax}. The grade is worked out for you. Tick Absent if the student missed the subject.
      </p>

      <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
        <option value="">Choose the term</option>
        {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
      </select>
      <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
        <option value="">Choose the class</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {classId && (
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={input} aria-label="Subject">
          <option value="">{subjects.length ? 'Choose the subject' : 'No subjects set for this class'}</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {cls && !cls.scored && <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">{cls.name} uses remarks only on report cards. Change this under Setup, Classes if you want scores.</p>}

      {classId && subjectId && termId && (loading ? <p className="text-slate-600">Loading…</p> : students.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">There are no active students in this class.</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">{completeCount} of {students.length} students have complete scores.</p>
          <ul className="flex flex-col gap-2">
            {students.map((s) => {
              const en = entries[s.id]
              const ck = checks[s.id]
              const total = ck.error ? null : en.absent ? 0 : ck.score
              const g = scale.length ? gradeFor(total, scale) : null
              return (
                <li key={s.id} className={`flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${bad[s.id] || ck.error ? 'ring-2 ring-red-500' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-sm text-slate-600">{s.admission_no}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{total === null ? '–' : total}</p>
                      {scale.length > 0 && <p className="text-sm text-slate-600">{g ? `${g.grade} ${g.remark}` : ''}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                    <label className="flex flex-col text-sm font-bold text-slate-700">Score out of {examMax}
                      <input inputMode="decimal" disabled={en.absent} value={en.text} onChange={(e) => set(s.id, { text: e.target.value })} className={`${input} text-lg font-bold disabled:bg-slate-100`} />
                    </label>
                    <label className="flex flex-col items-center text-sm font-bold text-slate-700">Absent
                      <input type="checkbox" checked={en.absent} onChange={(e) => set(s.id, { absent: e.target.checked })} className="mt-3 h-7 w-7" />
                    </label>
                  </div>
                  {(ck.error || bad[s.id]) && <p className="text-sm text-red-700">{ck.error ?? bad[s.id]}</p>}
                </li>
              )
            })}
          </ul>
          {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
          <button onClick={save} className="sticky bottom-3 rounded-lg bg-brand p-4 text-base font-semibold text-white shadow-lg">Save scores</button>
        </>
      ))}
      {msg && !msg.ok && students.length === 0 && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">{msg.text}</p>}
    </div>
  )
}

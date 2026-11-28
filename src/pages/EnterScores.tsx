import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import type { GradeRow } from '../lib/grades'
import { checkScore, gradeFor, isComplete, subjectTotal } from '../lib/results'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

type Student = { id: string; full_name: string; admission_no: string }
type Entry = { c: string; x: string; absent: boolean }
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const show = (n: number | null) => (n === null ? '' : String(n))

export default function EnterScores() {
  const { currentTerm, classMax, examMax } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string; scored: boolean }[]>([])
  const [scale, setScale] = useState<GradeRow[]>([])
  const [classId, setClassId] = useState('')
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [doneBy, setDoneBy] = useState<Record<string, Set<string>>>({})
  const [showAll, setShowAll] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [bad, setBad] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase!.from('classes').select('id, name, scored').order('level_order'),
      supabase!.from('grade_scale').select('min_score, max_score, grade, remark'),
    ]).then(([c, g]) => {
      setClasses(c.data ?? [])
      setScale(((g.data ?? []) as GradeRow[]).map((r) => ({ ...r, min_score: Number(r.min_score), max_score: Number(r.max_score), remark: r.remark ?? '' })))
    })
  }, [])
  const termId = currentTerm?.id ?? ''

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
    setBad({})
    const { data: st } = await supabase!.from('students').select('id, full_name, admission_no').eq('class_id', classId).eq('status', 'active').order('full_name')
    const list = (st as Student[]) ?? []
    const ids = list.map((x) => x.id)
    const { data: sc } = ids.length
      ? await supabase!.from('scores').select('student_id, subject_id, class_score, exam_score, is_absent').eq('term_id', termId).in('student_id', ids)
      : { data: [] as { student_id: string; subject_id: string; class_score: unknown; exam_score: unknown; is_absent: boolean }[] }
    const done: Record<string, Set<string>> = {}
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
    // a student is finished in a subject only when both scores are in (or marked absent)
    for (const r of sc ?? []) if (isComplete(num(r.class_score), num(r.exam_score), r.is_absent)) (done[r.subject_id as string] ??= new Set()).add(r.student_id as string)
    const e: Record<string, Entry> = {}
    for (const x of list) {
      const r = (sc ?? []).find((y) => y.student_id === x.id && y.subject_id === subjectId)
      e[x.id] = { c: show(num(r?.class_score)), x: show(num(r?.exam_score)), absent: r?.is_absent ?? false }
    }
    setStudents(list)
    setDoneBy(done)
    setEntries(e)
    setLoading(false)
  }, [classId, subjectId, termId])
  useEffect(() => { setShowAll(false); load() }, [load])

  const cls = classes.find((c) => c.id === classId)
  const doneHere = doneBy[subjectId] ?? new Set<string>()
  const pending = students.filter((x) => !doneHere.has(x.id))
  const visible = showAll ? students : pending
  const pendingFor = (sid: string) => students.filter((x) => !(doneBy[sid]?.has(x.id))).length
  const checks = useMemo(() => Object.fromEntries(students.map((s) => { const en = entries[s.id] ?? { c: '', x: '', absent: false }; return [s.id, checkScore({ classText: en.c, examText: en.x, absent: en.absent }, classMax, examMax)] })), [students, entries, classMax, examMax])

  const set = (id: string, patch: Partial<Entry>) => setEntries({ ...entries, [id]: { ...entries[id], ...patch } })

  async function save() {
    const errs: Record<string, string> = {}
    for (const x of visible) if (checks[x.id]?.error) errs[x.id] = checks[x.id].error!
    setBad(errs)
    if (Object.keys(errs).length) return setMsg({ ok: false, text: `Please fix the ${Object.keys(errs).length} student${Object.keys(errs).length === 1 ? '' : 's'} marked in red. Nothing was saved.` })
    const entered = visible.filter((x) => checks[x.id].classScore !== null || checks[x.id].examScore !== null || entries[x.id].absent)
    if (entered.length === 0) return setMsg({ ok: false, text: 'You have not typed any score yet.' })
    const rows = entered.map((x) => ({ student_id: x.id, class_score: checks[x.id].classScore, exam_score: checks[x.id].examScore, is_absent: entries[x.id].absent }))
    const { error } = await supabase!.rpc('save_scores', { p_class: classId, p_subject: subjectId, p_term: termId, p_rows: rows })
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'The scores could not be saved. Please try again.') })
    // Move on: if this subject is finished, go to the next subject that still has students waiting.
    const left = pending.length - entered.filter((x) => !doneHere.has(x.id)).length
    const idx = subjects.findIndex((x) => x.id === subjectId)
    const order = [...subjects.slice(idx + 1), ...subjects.slice(0, idx)]
    if (left <= 0 && !showAll) {
      const next = order.find((x) => pendingFor(x.id) > 0)
      if (next) { setSubjectId(next.id); setMsg({ ok: true, text: `Saved. ${subjects[idx]?.name} is finished. Now enter ${next.name}.` }); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      setMsg({ ok: true, text: `Saved. All subjects for ${cls?.name} are finished.` })
    } else {
      setMsg({ ok: true, text: `Saved ${entered.length} score${entered.length === 1 ? '' : 's'}.` })
    }
    await load()
  }

  // Pressing Enter in a score box jumps to the next student's box.
  function nextBox(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-score]:not(:disabled)'))
    const i = boxes.indexOf(e.currentTarget)
    boxes[i + 1]?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Enter Scores</h1>
        <Link to="/scores/results" className="text-sm underline">Class results</Link>
      </div>
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        Type each student's class score (out of {classMax}) and exam score (out of {examMax}). The total and grade are worked out for you. Tick Absent if the student missed the subject.
      </p>

      {currentTerm
        ? <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm">Term: {currentTerm.name}, {currentTerm.year_name}</p>
        : <p className="rounded-xl bg-amber-100 p-4 text-sm font-semibold text-amber-900">No current term is set yet. Ask the Admin to set it first (Set up, then Current term).</p>}
      <select value={classId} onChange={(e) => { setClassId(e.target.value); setMsg(null) }} className={input} aria-label="Class">
        <option value="">Choose the class</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {classId && (
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setMsg(null) }} className={input} aria-label="Subject">
          <option value="">{subjects.length ? 'Choose the subject' : 'No subjects set for this class'}</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{doneBy[s.id] ? ` (${pendingFor(s.id)} waiting)` : ''}</option>)}
        </select>
      )}

      {cls && !cls.scored && <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">{cls.name} uses remarks only on report cards. Change this under Setup, Classes if you want scores.</p>}

      {classId && subjectId && termId && (loading ? <p className="text-slate-600">Loading…</p> : students.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">There are no active students in this class.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-600">{showAll ? `All ${students.length} students` : `${pending.length} of ${students.length} students still waiting for scores`}</p>
            <button onClick={() => setShowAll(!showAll)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">{showAll ? 'Show only students waiting' : 'Show all students (to correct a score)'}</button>
          </div>
          {visible.length === 0 && <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900">Every student in this class has both scores for this subject. Choose another subject, or show all students to correct a score.</p>}
          <ul className="flex flex-col gap-2">
            {visible.map((s) => {
              const en = entries[s.id]
              const ck = checks[s.id]
              const total = ck.error ? null : subjectTotal(ck.classScore, ck.examScore, en.absent)
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
                  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                    <label className="flex flex-col text-sm font-bold text-slate-700">Class score /{classMax}
                      <input data-score onKeyDown={nextBox} enterKeyHint="next" inputMode="decimal" disabled={en.absent} value={en.c} onChange={(e) => set(s.id, { c: e.target.value })} className={`${input} text-lg font-bold disabled:bg-slate-100`} />
                    </label>
                    <label className="flex flex-col text-sm font-bold text-slate-700">Exam score /{examMax}
                      <input data-score onKeyDown={nextBox} enterKeyHint="next" inputMode="decimal" disabled={en.absent} value={en.x} onChange={(e) => set(s.id, { x: e.target.value })} className={`${input} text-lg font-bold disabled:bg-slate-100`} />
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
          {msg && <p className={`rounded-xl p-4 text-sm font-semibold ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
          <button onClick={save} disabled={visible.length === 0} className="sticky bottom-3 rounded-lg bg-brand p-4 disabled:opacity-50 text-base font-semibold text-white shadow-lg">Save scores</button>
        </>
      ))}
      {msg && !msg.ok && students.length === 0 && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">{msg.text}</p>}
    </div>
  )
}

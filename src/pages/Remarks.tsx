import { useCallback, useEffect, useState } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

type Student = { id: string; full_name: string; admission_no: string }
type Remark = { teacher: string; head: string }
type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }

const MAX = 300
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'

export default function Remarks() {
  const { currentTerm } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [remarks, setRemarks] = useState<Record<string, Remark>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

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

  const load = useCallback(async () => {
    if (!classId || !termId) return setStudents([])
    setLoading(true)
    setMsg(null)
    const s = await supabase!.from('students').select('id, full_name, admission_no').eq('class_id', classId).eq('status', 'active').order('full_name')
    const list = (s.data as Student[]) ?? []
    const saved = list.length
      ? await supabase!.from('report_remarks').select('student_id, teacher_remark, head_remark').eq('term_id', termId).in('student_id', list.map((x) => x.id))
      : { data: [] }
    const by = new Map((saved.data ?? []).map((r) => [r.student_id as string, r]))
    const m: Record<string, Remark> = {}
    for (const st of list) m[st.id] = { teacher: by.get(st.id)?.teacher_remark ?? '', head: by.get(st.id)?.head_remark ?? '' }
    setStudents(list)
    setRemarks(m)
    setLoading(false)
  }, [classId, termId])
  useEffect(() => { load() }, [load])

  const set = (id: string, patch: Partial<Remark>) => setRemarks({ ...remarks, [id]: { ...remarks[id], ...patch } })
  const filled = students.filter((s) => remarks[s.id]?.teacher.trim() || remarks[s.id]?.head.trim()).length

  async function save() {
    const rows = students.map((s) => ({ student_id: s.id, teacher_remark: remarks[s.id].teacher, head_remark: remarks[s.id].head }))
    const { error } = await supabase!.rpc('save_remarks', { p_class: classId, p_term: termId, p_rows: rows })
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not save. Please try again.') })
    setMsg({ ok: true, text: `Saved. ${filled} of ${students.length} students have a remark.` })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Remarks</h1>
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        Write a short teacher remark and, if needed, a headmaster remark for each student. They are printed on the report card (up to {MAX} characters each).
      </p>
      <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
        <option value="">Choose the term</option>
        {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
      </select>
      <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
        <option value="">Choose the class</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {classId && termId && (loading ? <p className="text-slate-600">Loading…</p> : students.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">There are no active students in this class.</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">{filled} of {students.length} students have a remark.</p>
          <ul className="flex flex-col gap-3">
            {students.map((s) => {
              const r = remarks[s.id]
              const over = r.teacher.length > MAX || r.head.length > MAX
              return (
                <li key={s.id} className={`flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${over ? 'ring-2 ring-red-500' : ''}`}>
                  <p className="font-medium">{s.full_name} <span className="text-sm font-normal text-slate-600">{s.admission_no}</span></p>
                  <label className="flex flex-col text-xs text-slate-600">Teacher remark ({r.teacher.length}/{MAX})
                    <textarea rows={2} value={r.teacher} onChange={(e) => set(s.id, { teacher: e.target.value })} className={`${input} text-sm`} />
                  </label>
                  <label className="flex flex-col text-xs text-slate-600">Headmaster remark ({r.head.length}/{MAX})
                    <textarea rows={2} value={r.head} onChange={(e) => set(s.id, { head: e.target.value })} className={`${input} text-sm`} />
                  </label>
                </li>
              )
            })}
          </ul>
          {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
          <button
            onClick={() => {
              if (students.some((s) => remarks[s.id].teacher.length > MAX || remarks[s.id].head.length > MAX)) return setMsg({ ok: false, text: `A remark can have at most ${MAX} characters. Shorten the marked students.` })
              save()
            }}
            className="sticky bottom-3 rounded-lg bg-brand p-4 text-base font-semibold text-white shadow-lg"
          >
            Save remarks
          </button>
        </>
      ))}
    </div>
  )
}

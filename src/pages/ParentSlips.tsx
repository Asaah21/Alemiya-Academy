import { useCallback, useEffect, useState } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import { formatCode, MAX_SLIPS_AT_ONCE, type IssueFailure, type IssuedSlip } from '../lib/parent-access'
import { supabase } from '../lib/supabase'

type Student = { id: string; full_name: string; admission_no: string }
type Access = { student_id: string; active: boolean; last_login: string | null }
const input = 'rounded-lg border border-slate-300 p-3 text-base'

async function callServer(body: unknown): Promise<{ ok: boolean; data?: any; error?: string }> {
  const { data } = await supabase!.auth.getSession()
  try {
    const res = await fetch('/.netlify/functions/parent-access', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? 'Something went wrong.' }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check the internet and try again.' }
  }
}

export default function ParentSlips() {
  const { schoolName } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [classId, setClassId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [access, setAccess] = useState<Map<string, Access>>(new Map())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [slips, setSlips] = useState<IssuedSlip[]>([])
  const [failed, setFailed] = useState<IssueFailure[]>([])

  useEffect(() => { supabase!.from('classes').select('id, name').order('level_order').then(({ data }) => setClasses(data ?? [])) }, [])

  const load = useCallback(async () => {
    if (!classId) return setStudents([])
    const { data: s } = await supabase!.from('students').select('id, full_name, admission_no').eq('class_id', classId).eq('status', 'active').order('full_name')
    const list = (s ?? []) as Student[]
    setStudents(list)
    if (list.length === 0) return setAccess(new Map())
    const { data: a } = await supabase!.from('parent_access').select('student_id, active, last_login').in('student_id', list.map((x) => x.id))
    setAccess(new Map(((a ?? []) as Access[]).map((r) => [r.student_id, r])))
  }, [classId])
  useEffect(() => { setSlips([]); setFailed([]); setMsg(null); load() }, [load])

  async function issue(ids: string[], what: string) {
    setBusy(true)
    setMsg(null)
    const r = await callServer({ action: 'issue', student_ids: ids })
    setBusy(false)
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? 'Something went wrong.' })
    setSlips(r.data.slips)
    setFailed(r.data.failed)
    setMsg({ ok: true, text: `${r.data.slips.length} slip${r.data.slips.length === 1 ? '' : 's'} ready for ${what}. Print them now: the codes cannot be shown again.` })
    load()
  }

  function issueClass() {
    if (students.length > MAX_SLIPS_AT_ONCE) return setMsg({ ok: false, text: `This class has more than ${MAX_SLIPS_AT_ONCE} students. Make slips one student at a time.` })
    const had = students.filter((s) => access.has(s.id)).length
    const warn = had > 0 ? `${had} student${had === 1 ? ' already has' : 's already have'} a code. Their old codes will stop working. ` : ''
    if (!window.confirm(`${warn}Make new slips for all ${students.length} students?`)) return
    issue(students.map((s) => s.id), 'the class')
  }

  function one(s: Student) {
    if (access.has(s.id) && !window.confirm(`${s.full_name} already has a code. The old code will stop working. Make a new slip?`)) return
    issue([s.id], s.full_name)
  }

  async function toggle(s: Student, active: boolean) {
    setBusy(true)
    const r = await callServer({ action: 'set_active', student_id: s.id, active })
    setBusy(false)
    setMsg(r.ok ? { ok: true, text: active ? `${s.full_name}'s parent can log in again.` : `${s.full_name}'s parent can no longer log in.` } : { ok: false, text: r.error ?? 'Something went wrong.' })
    load()
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 print:hidden">
        <h1 className="text-2xl font-bold">Parent access slips</h1>
        <p className="text-sm text-slate-600">Each parent logs in with the child's admission number and a private code printed on a slip. Give the slip to the parent in person.</p>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
          <option value="">Choose the class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
        {failed.length > 0 && (
          <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
            <p className="font-medium">No slip for:</p>
            <ul className="list-disc pl-5">{failed.map((f) => <li key={f.student_id}>{f.full_name}: {f.reason}</li>)}</ul>
          </div>
        )}
        {slips.length > 0 && <button onClick={() => window.print()} className="rounded-lg bg-brand p-3 font-semibold text-white">Print {slips.length} slip{slips.length === 1 ? '' : 's'}</button>}
        {classId && students.length > 0 && (
          <>
            <button onClick={issueClass} disabled={busy} className="rounded-lg border border-slate-300 p-3 font-medium disabled:opacity-60">{busy ? 'Working…' : `Make slips for all ${students.length} students`}</button>
            <ul className="flex flex-col gap-2">
              {students.map((s) => {
                const a = access.get(s.id)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
                    <p>
                      <span className="block font-medium">{s.full_name}</span>
                      <span className="text-xs text-slate-600">
                        {s.admission_no} · {!a ? 'No code yet' : !a.active ? 'Stopped' : a.last_login ? `Last login ${new Date(a.last_login).toLocaleDateString('en-GB')}` : 'Code made, not used yet'}
                      </span>
                    </p>
                    <span className="flex gap-2">
                      <button onClick={() => one(s)} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{a ? 'New code' : 'Make slip'}</button>
                      {a && <button onClick={() => toggle(s, !a.active)} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{a.active ? 'Stop' : 'Allow'}</button>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {classId && students.length === 0 && <p className="text-slate-600">There are no active students in this class.</p>}
      </div>

      {slips.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-0">
          {slips.map((s) => (
            <section key={s.student_id} className="break-inside-avoid border border-dashed border-slate-500 bg-white p-4 text-slate-900 print:h-[70mm] print:p-3">
              <p className="text-center text-sm font-bold uppercase">{schoolName}</p>
              <p className="text-center text-xs">Parent portal access</p>
              <p className="mt-2 text-sm"><strong>{s.full_name}</strong> · {s.class_name}</p>
              <p className="text-sm">Admission number: <strong>{s.admission_no}</strong></p>
              <p className="mt-1 text-sm">Access code:</p>
              <p className="text-center font-mono text-2xl font-bold tracking-widest">{formatCode(s.code)}</p>
              <p className="mt-1 text-xs">Go to: {origin}/parent</p>
              <p className="text-xs">Keep this code private. Do not share it.</p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

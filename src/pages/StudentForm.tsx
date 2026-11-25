import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import Movements from '../features/students/Movements'
import { STATUS_LABELS, validateStudent, type StudentInput } from '../lib/students'
import { supabase } from '../lib/supabase'

const today = () => new Date().toISOString().slice(0, 10)
const blank: StudentInput = { full_name: '', gender: '', date_of_birth: '', class_id: '', guardian_name: '', guardian_phone: '', admitted_on: today() }

// New student (Admin or Staff) or view/edit one (only Admin can save changes).
export default function StudentForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { state } = useAuth()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const readOnly = !isNew && !isAdmin

  const [form, setForm] = useState<StudentInput>(blank)
  const [meta, setMeta] = useState<{ admission_no: string; status: string } | null>(null)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [joinedAs, setJoinedAs] = useState<'new' | 'transfer_in'>('new')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    supabase!.from('classes').select('id, name').order('level_order').then(({ data }) => setClasses(data ?? []))
    if (!isNew) {
      supabase!.from('students').select('*').eq('id', id).maybeSingle().then(({ data }) => {
        if (!data) return setMsg({ ok: false, text: 'Student not found.' })
        setForm({
          full_name: data.full_name, gender: data.gender, date_of_birth: data.date_of_birth ?? '', class_id: data.class_id ?? '',
          guardian_name: data.guardian_name ?? '', guardian_phone: data.guardian_phone ?? '', admitted_on: data.admitted_on ?? '',
        })
        setMeta({ admission_no: data.admission_no, status: data.status })
      })
    }
  }, [id, isNew, version])

  const set = (k: keyof StudentInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    const v = validateStudent(form)
    if (!v.ok) return setMsg({ ok: false, text: v.error })
    const body = {
      full_name: form.full_name.trim(), gender: form.gender, class_id: form.class_id,
      date_of_birth: form.date_of_birth || null, guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null, admitted_on: form.admitted_on || null,
    }
    const insertBody = { ...body, joined_as: joinedAs }
    if (isNew) {
      const { data, error } = await supabase!.from('students').insert(insertBody).select('id, admission_no').single()
      if (error || !data) return setMsg({ ok: false, text: 'Could not save. Please try again.' })
      navigate(`/students/${data.id}`, { replace: true, state: { added: data.admission_no } })
    } else {
      const { data, error } = await supabase!.from('students').update(body).eq('id', id).select('id')
      if (error || !data?.length) return setMsg({ ok: false, text: 'Could not save. Only the Admin can change a student.' })
      setMsg({ ok: true, text: 'Saved.' })
    }
  }

  const input = 'rounded-lg border border-slate-300 p-3 text-base disabled:bg-slate-100'
  const label = 'flex flex-col gap-1 text-sm font-medium'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{isNew ? 'Add student' : form.full_name || 'Student'}</h1>
      {meta && (
        <p className="text-sm text-slate-600">
          {meta.admission_no} · {STATUS_LABELS[meta.status]}
        </p>
      )}
      {readOnly && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">Only the Admin can change student details.</p>}
      {isNew && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">The admission number is given automatically when you save.</p>}
      <form onSubmit={save} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className={label}>Full name<input disabled={readOnly} value={form.full_name} onChange={set('full_name')} className={input} /></label>
        <label className={label}>Gender
          <select disabled={readOnly} value={form.gender} onChange={set('gender')} className={input}>
            <option value="">Choose</option><option value="male">Male</option><option value="female">Female</option>
          </select>
        </label>
        <label className={label}>Class
          <select disabled={readOnly} value={form.class_id} onChange={set('class_id')} className={input}>
            <option value="">Choose</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className={label}>Date of birth<input type="date" disabled={readOnly} value={form.date_of_birth} onChange={set('date_of_birth')} className={input} /></label>
        <label className={label}>Guardian name<input disabled={readOnly} value={form.guardian_name} onChange={set('guardian_name')} className={input} /></label>
        <label className={label}>Guardian phone<input inputMode="tel" disabled={readOnly} value={form.guardian_phone} onChange={set('guardian_phone')} className={input} /></label>
        {isNew && (
          <label className={label}>How did the student join?
            <select value={joinedAs} onChange={(e) => setJoinedAs(e.target.value as 'new' | 'transfer_in')} className={input}>
              <option value="new">New admission</option>
              <option value="transfer_in">Transferred in from another school</option>
            </select>
          </label>
        )}
        <label className={label}>Date admitted<input type="date" disabled={readOnly} value={form.admitted_on} onChange={set('admitted_on')} className={input} /></label>
        {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
        {!readOnly && <button className="rounded-lg bg-brand p-3 font-semibold text-white">{isNew ? 'Save student' : 'Save changes'}</button>}
      </form>
      {!isNew && meta && id && (
        <Movements studentId={id} status={meta.status} isAdmin={isAdmin} onChanged={() => setVersion((v) => v + 1)} />
      )}
    </div>
  )
}

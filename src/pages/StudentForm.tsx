import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ListChecks, Receipt, UserPlus } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import Movements from '../features/students/Movements'
import { STATUS_LABELS, validateStudent, type StudentInput } from '../lib/students'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { checkName, checkOptionalPhone } from '../lib/validation'

const today = () => new Date().toISOString().slice(0, 10)
const blank: StudentInput = { full_name: '', gender: '', date_of_birth: '', class_id: '', guardian_name: '', guardian_phone: '', admitted_on: today() }

// New student (Admin or Staff) or view/edit one (only Admin can save changes).
export default function StudentForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const { state } = useAuth()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const readOnly = !isNew && !isAdmin

  const [form, setForm] = useState<StudentInput>(blank)
  const [meta, setMeta] = useState<{ admission_no: string; status: string } | null>(null)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saved, setSaved] = useState<{ id: string; name: string; admission_no: string; className: string } | null>(null)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)

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
    const phone = checkOptionalPhone(form.guardian_phone, 'guardian’s phone number')
    const name = checkName(form.full_name, 'student’s full name')
    if (!name.ok || !phone.ok) return
    const body = {
      full_name: name.value, gender: form.gender, class_id: form.class_id,
      date_of_birth: form.date_of_birth || null, guardian_name: form.guardian_name.trim() ? checkName(form.guardian_name, 'guardian’s name').ok ? form.guardian_name.trim().replace(/\s+/g, ' ') : null : null,
      guardian_phone: phone.value, admitted_on: form.admitted_on || null,
    }
    setBusy(true); setMsg(null)
    if (isNew) {
      const { data, error } = await supabase!.from('students').insert(body).select('id, admission_no').single()
      setBusy(false)
      if (error || !data) return setMsg({ ok: false, text: friendlyError(error, 'The student could not be saved. Please check the details and try again.') })
      setSaved({ id: data.id, name: body.full_name, admission_no: data.admission_no, className: classes.find((c) => c.id === form.class_id)?.name ?? '' })
      window.scrollTo({ top: 0 })
    } else {
      const { data, error } = await supabase!.from('students').update(body).eq('id', id).select('id')
      setBusy(false)
      if (error || !data?.length) return setMsg({ ok: false, text: error ? friendlyError(error, 'The changes could not be saved. Please try again.') : 'The changes were not saved. Only the Admin can change a student.' })
      setMsg({ ok: true, text: 'Changes saved.' })
    }
  }

  function addAnother() {
    setSaved(null); setMsg(null)
    setForm({ ...blank, class_id: form.class_id, admitted_on: form.admitted_on })
  }

  if (saved) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-3 text-2xl font-bold text-green-900">Student saved</h1>
          <p className="mt-1 text-lg font-bold text-slate-900">{saved.name}</p>
          <p className="text-sm font-semibold text-slate-600">Admission number {saved.admission_no}{saved.className ? ` · ${saved.className}` : ''}</p>
        </div>
        <p className="text-sm font-bold text-slate-500">What would you like to do next?</p>
        <Link to={`/fees?student=${saved.id}`} className="flex items-center gap-4 rounded-xl bg-brand p-5 text-white shadow-sm hover:bg-ink"><Receipt className="h-6 w-6" /><span><span className="block font-bold">Record a fee payment</span><span className="block text-sm font-medium opacity-80">For {saved.name}</span></span></Link>
        <button onClick={addAnother} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-brand/40"><UserPlus className="h-6 w-6 text-brand" /><span><span className="block font-bold text-slate-900">Add another student</span><span className="block text-sm font-medium text-slate-500">Start a new, empty form</span></span></button>
        <Link to="/students" className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand/40"><ListChecks className="h-6 w-6 text-brand" /><span><span className="block font-bold text-slate-900">Go to the student list</span><span className="block text-sm font-medium text-slate-500">See everyone in school</span></span></Link>
      </div>
    )
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
        <label className={label}>Guardian phone (10 digits)<input inputMode="tel" placeholder="0241234567" disabled={readOnly} value={form.guardian_phone} onChange={set('guardian_phone')} className={input} /></label>
        <label className={label}>Date admitted<input type="date" disabled={readOnly} value={form.admitted_on} onChange={set('admitted_on')} className={input} /></label>
        {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
        {!readOnly && <button disabled={busy} className="rounded-lg bg-brand p-3.5 font-bold text-white shadow-sm hover:bg-ink disabled:opacity-60">{busy ? 'Saving…' : isNew ? 'Save student' : 'Save changes'}</button>}
      </form>
      {!isNew && meta && id && (
        <Movements studentId={id} status={meta.status} isAdmin={isAdmin} onChanged={() => setVersion((v) => v + 1)} />
      )}
    </div>
  )
}

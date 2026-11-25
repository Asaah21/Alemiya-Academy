import { useEffect, useState, type FormEvent } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import { supabase } from '../lib/supabase'

type Form = {
  school_name: string; location: string; district: string; region: string; circuit: string
  next_term_opening_date: string; class_score_max: string; exam_score_max: string
}
const empty: Form = { school_name: '', location: '', district: '', region: '', circuit: '', next_term_opening_date: '', class_score_max: '30', exam_score_max: '70' }

export default function SchoolDetails() {
  const { reload } = useSchool()
  const [form, setForm] = useState<Form>(empty)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase!.from('settings').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setForm({
          school_name: data.school_name ?? '', location: data.location ?? '', district: data.district ?? '',
          region: data.region ?? '', circuit: data.circuit ?? '',
          next_term_opening_date: data.next_term_opening_date ?? '',
          class_score_max: String(data.class_score_max), exam_score_max: String(data.exam_score_max),
        })
      }
    })
  }, [])

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    const cls = Number(form.class_score_max), exam = Number(form.exam_score_max)
    if (!form.school_name.trim()) return setMsg({ ok: false, text: 'Enter the school name.' })
    if (!(cls > 0) || !(exam > 0)) return setMsg({ ok: false, text: 'Class score and exam score must be more than 0.' })
    const { error } = await supabase!.from('settings').upsert(
      {
        singleton: true,
        school_name: form.school_name.trim(),
        location: form.location.trim() || null, district: form.district.trim() || null,
        region: form.region.trim() || null, circuit: form.circuit.trim() || null,
        next_term_opening_date: form.next_term_opening_date || null,
        class_score_max: cls, exam_score_max: exam,
      },
      { onConflict: 'singleton' },
    )
    if (error) return setMsg({ ok: false, text: 'Could not save. Please try again.' })
    setMsg({ ok: true, text: 'Saved.' })
    reload()
  }

  const input = 'rounded-lg border border-slate-300 p-3 text-base'
  const label = 'flex flex-col gap-1 text-sm font-medium'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-brand">School details</h1>
      <form onSubmit={save} className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
        <label className={label}>School name<input value={form.school_name} onChange={set('school_name')} className={input} /></label>
        <label className={label}>Location<input value={form.location} onChange={set('location')} className={input} /></label>
        <label className={label}>District<input value={form.district} onChange={set('district')} className={input} /></label>
        <label className={label}>Region<input value={form.region} onChange={set('region')} className={input} /></label>
        <label className={label}>Circuit<input value={form.circuit} onChange={set('circuit')} className={input} /></label>
        <label className={label}>Next term opens (printed on report cards)<input type="date" value={form.next_term_opening_date} onChange={set('next_term_opening_date')} className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Class score out of<input inputMode="decimal" value={form.class_score_max} onChange={set('class_score_max')} className={input} /></label>
          <label className={label}>Exam score out of<input inputMode="decimal" value={form.exam_score_max} onChange={set('exam_score_max')} className={input} /></label>
        </div>
        <p className="text-xs text-slate-500">Marks are entered out of these numbers; the total is out of 100 when they add up to 100.</p>
        {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
        <button className="rounded-lg bg-brand p-3 font-semibold text-white">Save</button>
      </form>
    </div>
  )
}

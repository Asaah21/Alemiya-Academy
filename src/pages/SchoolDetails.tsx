import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useSchool } from '../features/school/SchoolProvider'
import { friendlyError } from '../lib/errors'
import { LOGO_ACCEPT, checkLogoFile, fitSize, logoPath } from '../lib/logo'
import { supabase } from '../lib/supabase'

type Form = {
  school_name: string; location: string; district: string; region: string; circuit: string
  next_term_opening_date: string; class_score_max: string; exam_score_max: string
}
const empty: Form = { school_name: '', location: '', district: '', region: '', circuit: '', next_term_opening_date: '', class_score_max: '30', exam_score_max: '70' }

export default function SchoolDetails() {
  const { reload, logoUrl } = useSchool()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [logoMsg, setLogoMsg] = useState<{ ok: boolean; text: string } | null>(null)
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
    if (!(cls > 0) || !(exam > 0) || Math.abs(cls + exam - 100) > 0.001) return setMsg({ ok: false, text: 'The class score and the exam score must add up to 100. Normally 30 and 70.' })
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
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not save. Please try again.') })
    setMsg({ ok: true, text: 'Saved.' })
    reload()
  }

  // Shrinks the chosen picture and keeps its transparency, then stores it and remembers its address.
  async function pickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ok = checkLogoFile(file)
    if (!ok.ok) return setLogoMsg({ ok: false, text: ok.error })
    setBusy(true); setLogoMsg(null)
    try {
      const bitmap = await createImageBitmap(file)
      const { width, height } = fitSize(bitmap.width, bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('no picture')
      const path = logoPath()
      const up = await supabase!.storage.from('school-logo').upload(path, blob, { contentType: 'image/png' })
      if (up.error) throw up.error
      const url = supabase!.storage.from('school-logo').getPublicUrl(path).data.publicUrl
      const { error } = await supabase!.from('settings').upsert({ singleton: true, logo_url: url }, { onConflict: 'singleton' })
      if (error) throw error
      setLogoMsg({ ok: true, text: 'The logo has been saved. It will show on report cards.' })
      reload()
    } catch (err) {
      setLogoMsg({ ok: false, text: friendlyError(err, 'The logo could not be saved. Check that the picture opens normally and try again.') })
    }
    setBusy(false)
  }

  async function removeLogo() {
    setBusy(true); setLogoMsg(null)
    const { error } = await supabase!.from('settings').update({ logo_url: null }).eq('singleton', true)
    setBusy(false)
    if (error) return setLogoMsg({ ok: false, text: friendlyError(error, 'The logo could not be removed. Please try again.') })
    setLogoMsg({ ok: true, text: 'The logo has been removed.' })
    reload()
  }

  const input = 'rounded-lg border border-slate-300 p-3 text-base'
  const label = 'flex flex-col gap-1 text-sm font-medium'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">School details</h1>
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-bold text-slate-900">School logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {logoUrl ? <img src={logoUrl} alt="School logo" className="h-full w-full object-contain" /> : <ImagePlus className="h-8 w-8 text-slate-300" />}
          </span>
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept={LOGO_ACCEPT} onChange={pickLogo} className="hidden" />
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-ink disabled:opacity-60">{busy ? 'Please wait…' : logoUrl ? 'Change logo' : 'Choose a logo'}</button>
            {logoUrl && <button type="button" disabled={busy} onClick={removeLogo} className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 disabled:opacity-60"><Trash2 className="h-4 w-4" /> Remove logo</button>}
          </div>
        </div>
        <p className="text-xs text-slate-500">Use a square or wide PNG or JPG picture. It appears on the menu and on every report card.</p>
        {logoMsg && <p className={`rounded-lg p-3 text-sm font-semibold ${logoMsg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{logoMsg.text}</p>}
      </section>
      <form onSubmit={save} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className={label}>School name<input value={form.school_name} onChange={set('school_name')} className={input} /></label>
        <label className={label}>Location<input value={form.location} onChange={set('location')} className={input} /></label>
        <label className={label}>District<input value={form.district} onChange={set('district')} className={input} /></label>
        <label className={label}>Region<input value={form.region} onChange={set('region')} className={input} /></label>
        <label className={label}>Circuit<input value={form.circuit} onChange={set('circuit')} className={input} /></label>
        <label className={label}>Next term opens (printed on report cards)<input type="date" value={form.next_term_opening_date} onChange={set('next_term_opening_date')} className={input} /></label>
        <label className={label}>Class score is out of<input inputMode="decimal" value={form.class_score_max} onChange={set('class_score_max')} className={input} /></label>
        <label className={label}>Exam score is out of<input inputMode="decimal" value={form.exam_score_max} onChange={set('exam_score_max')} className={input} /></label>
        <p className="text-xs text-slate-500">Normally 30 and 70. Together they must make 100, because grades are worked out out of 100.</p>
        {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
        <button className="rounded-lg bg-brand p-3 font-semibold text-white">Save</button>
      </form>
    </div>
  )
}

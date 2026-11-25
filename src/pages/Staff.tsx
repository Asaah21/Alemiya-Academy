import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { filterStaff, validateStaff, type StaffInput } from '../lib/staff'
import { supabase } from '../lib/supabase'

type Row = { id: string; full_name: string; phone: string | null; subject_notes: string | null; class_id: string | null; status: 'active' | 'inactive' }

const blank: StaffInput = { full_name: '', phone: '', subject_notes: '', class_id: '' }
const input = 'rounded-lg border border-slate-300 p-3 text-base'

export default function Staff() {
  const [rows, setRows] = useState<Row[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState<StaffInput>(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase!.from('staff').select('id, full_name, phone, subject_notes, class_id, status').order('full_name'),
      supabase!.from('classes').select('id, name').order('level_order'),
    ])
    setRows((s.data as Row[]) ?? [])
    setClasses(c.data ?? [])
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name

  async function save(e: FormEvent) {
    e.preventDefault()
    const v = validateStaff(form)
    if (!v.ok) return setMsg({ ok: false, text: v.error })
    const body = {
      full_name: form.full_name.trim(), phone: form.phone.trim() || null,
      subject_notes: form.subject_notes.trim() || null, class_id: form.class_id || null,
    }
    const { error } = editing
      ? await supabase!.from('staff').update(body).eq('id', editing)
      : await supabase!.from('staff').insert(body)
    if (error) return setMsg({ ok: false, text: 'Could not save. Please try again.' })
    setMsg({ ok: true, text: editing ? 'Saved.' : `${body.full_name} added.` })
    setForm(blank)
    setEditing(null)
    refresh()
  }

  async function setActive(r: Row, active: boolean) {
    const { error } = await supabase!.from('staff').update({ status: active ? 'active' : 'inactive' }).eq('id', r.id)
    setMsg(error ? { ok: false, text: 'Could not save.' } : { ok: true, text: `${r.full_name} is now ${active ? 'active' : 'inactive'}.` })
    refresh()
  }

  const shown = filterStaff(rows, { search, status })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-brand">Staff</h1>
      <p className="rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">
        This is the list of people who work at the school (used for daily staff attendance). To let someone log in, add them under Users as well.
      </p>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}

      <form onSubmit={save} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">{editing ? 'Edit staff member' : 'Add a staff member'}</h2>
        <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} />
        <input inputMode="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
        <input placeholder="Subject (optional)" value={form.subject_notes} onChange={(e) => setForm({ ...form, subject_notes: e.target.value })} className={input} />
        <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className={input} aria-label="Class">
          <option value="">Class (optional)</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-brand p-3 font-semibold text-white">{editing ? 'Save changes' : 'Add staff member'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank) }} className="rounded-lg border border-slate-300 px-4">Cancel</button>}
        </div>
      </form>

      <input type="search" placeholder="Search name, phone or subject" value={search} onChange={(e) => setSearch(e.target.value)} className={input} />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={input} aria-label="Status">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="">All</option>
      </select>

      <ul className="flex flex-col gap-2">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
            <div>
              <p className="font-medium">
                {r.full_name}
                {r.status === 'inactive' && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">Inactive</span>}
              </p>
              <p className="text-sm text-slate-600">{[r.subject_notes, className(r.class_id), r.phone].filter(Boolean).join(' · ') || 'No details yet'}</p>
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => { setEditing(r.id); setForm({ full_name: r.full_name, phone: r.phone ?? '', subject_notes: r.subject_notes ?? '', class_id: r.class_id ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="rounded-lg border border-slate-300 px-3 py-2">Edit</button>
              <button onClick={() => setActive(r, r.status !== 'active')} className="rounded-lg border border-slate-300 px-3 py-2">
                {r.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-slate-600">No staff to show.</li>}
      </ul>
    </div>
  )
}

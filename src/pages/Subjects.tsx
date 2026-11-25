import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Subject = { id: string; name: string; type: 'core' | 'elective' }

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<'core' | 'elective'>('core')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase!.from('subjects').select('id, name, type').order('name')
    setSubjects((data as Subject[]) ?? [])
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (n.length < 2) return setMsg({ ok: false, text: 'Enter the subject name.' })
    const { error } = await supabase!.from('subjects').insert({ name: n, type })
    if (error) return setMsg({ ok: false, text: error.code === '23505' ? 'This subject already exists.' : 'Could not save.' })
    setName('')
    setMsg({ ok: true, text: `${n} added. Tick it for the classes that take it (Setup, Classes).` })
    refresh()
  }

  async function rename(s: Subject) {
    const n = window.prompt('New name for this subject', s.name)?.trim()
    if (!n || n === s.name) return
    const { error } = await supabase!.from('subjects').update({ name: n }).eq('id', s.id)
    setMsg(error ? { ok: false, text: 'Could not save. Is the name already used?' } : { ok: true, text: 'Saved.' })
    refresh()
  }

  const input = 'rounded-lg border border-slate-300 p-3 text-base'
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subjects</h1>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
      <form onSubmit={add} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Add a subject</h2>
        <input placeholder="Mathematics" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <select value={type} onChange={(e) => setType(e.target.value as 'core' | 'elective')} className={input}>
          <option value="core">Core</option>
          <option value="elective">Elective</option>
        </select>
        <button className="rounded-lg bg-brand p-3 font-semibold text-white">Add subject</button>
      </form>
      <ul className="flex flex-col gap-2">
        {subjects.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="font-medium">{s.name} <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs capitalize">{s.type}</span></p>
            <button onClick={() => rename(s)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Rename</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { STANDARD_CLASSES } from '../lib/grades'
import { supabase } from '../lib/supabase'

type Cls = { id: string; name: string; level_order: number; scored: boolean }
type Subject = { id: string; name: string }

export default function Classes() {
  const [classes, setClasses] = useState<Cls[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [links, setLinks] = useState<Set<string>>(new Set()) // "classId|subjectId"
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const [c, s, l] = await Promise.all([
      supabase!.from('classes').select('id, name, level_order, scored').order('level_order'),
      supabase!.from('subjects').select('id, name').order('name'),
      supabase!.from('class_subjects').select('class_id, subject_id'),
    ])
    setClasses((c.data as Cls[]) ?? [])
    setSubjects((s.data as Subject[]) ?? [])
    setLinks(new Set(((l.data as { class_id: string; subject_id: string }[]) ?? []).map((x) => `${x.class_id}|${x.subject_id}`)))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function createStandard() {
    const have = new Set(classes.map((c) => c.name))
    const rows = STANDARD_CLASSES.map((c, i) => ({ ...c, level_order: i + 1 })).filter((c) => !have.has(c.name))
    if (rows.length === 0) return setMsg({ ok: true, text: 'All 14 classes already exist.' })
    const { error } = await supabase!.from('classes').insert(rows)
    setMsg(error ? { ok: false, text: 'Could not create the classes.' } : { ok: true, text: `${rows.length} classes created.` })
    refresh()
  }

  async function toggleScored(c: Cls) {
    const { error } = await supabase!.from('classes').update({ scored: !c.scored }).eq('id', c.id)
    if (error) setMsg({ ok: false, text: 'Could not save.' })
    refresh()
  }

  async function toggleSubject(c: Cls, s: Subject) {
    const key = `${c.id}|${s.id}`
    const q = links.has(key)
      ? supabase!.from('class_subjects').delete().eq('class_id', c.id).eq('subject_id', s.id)
      : supabase!.from('class_subjects').insert({ class_id: c.id, subject_id: s.id })
    const { error } = await q
    if (error) setMsg({ ok: false, text: 'Could not save.' })
    refresh()
  }

  const count = (c: Cls) => subjects.filter((s) => links.has(`${c.id}|${s.id}`)).length

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-brand">Classes</h1>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
      {classes.length < STANDARD_CLASSES.length && (
        <button onClick={createStandard} className="rounded-lg bg-brand p-3 font-semibold text-white">
          Create the 14 classes (Creche to JHS 3)
        </button>
      )}
      <ul className="flex flex-col gap-2">
        {classes.map((c) => (
          <li key={c.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-600">
                  {c.scored ? 'Scores and grades' : 'Remarks only (no scores)'} · {count(c)} subjects
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => toggleScored(c)} className="rounded-lg border border-slate-300 px-3 py-2">
                  {c.scored ? 'Make remarks only' : 'Make scored'}
                </button>
                <button onClick={() => setOpen(open === c.id ? null : c.id)} className="rounded-lg border border-slate-300 px-3 py-2">
                  {open === c.id ? 'Close' : 'Subjects'}
                </button>
              </div>
            </div>
            {open === c.id && (
              <div className="mt-3 grid grid-cols-1 gap-1 border-t border-slate-200 pt-3 sm:grid-cols-2">
                {subjects.length === 0 && <p className="text-sm text-slate-600">Add subjects first (Setup, Subjects).</p>}
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 rounded-lg p-2 text-base">
                    <input type="checkbox" className="h-5 w-5" checked={links.has(`${c.id}|${s.id}`)} onChange={() => toggleSubject(c, s)} />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

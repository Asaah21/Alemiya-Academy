import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { gaps, STARTER_SCALE, validateGrade, type GradeRow } from '../lib/grades'
import { supabase } from '../lib/supabase'

export default function Grades() {
  const [rows, setRows] = useState<GradeRow[]>([])
  const [f, setF] = useState({ min: '', max: '', grade: '', remark: '' })
  const [editing, setEditing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase!.from('grade_scale').select('id, min_score, max_score, grade, remark').order('min_score', { ascending: false })
    setRows(((data ?? []) as GradeRow[]).map((r) => ({ ...r, min_score: Number(r.min_score), max_score: Number(r.max_score), remark: r.remark ?? '' })))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function save(e: FormEvent) {
    e.preventDefault()
    const g: GradeRow = { id: editing ?? undefined, min_score: Number(f.min), max_score: Number(f.max), grade: f.grade.trim(), remark: f.remark.trim() }
    if (f.min === '' || f.max === '') return setMsg({ ok: false, text: 'Enter the lowest and highest score.' })
    const v = validateGrade(g, rows)
    if (!v.ok) return setMsg({ ok: false, text: v.error })
    const body = { min_score: g.min_score, max_score: g.max_score, grade: g.grade, remark: g.remark || null }
    const { error } = editing ? await supabase!.from('grade_scale').update(body).eq('id', editing) : await supabase!.from('grade_scale').insert(body)
    if (error) return setMsg({ ok: false, text: 'Could not save. Check the ranges do not overlap.' })
    setF({ min: '', max: '', grade: '', remark: '' })
    setEditing(null)
    setMsg({ ok: true, text: 'Saved.' })
    refresh()
  }

  async function remove(r: GradeRow) {
    const { error } = await supabase!.from('grade_scale').delete().eq('id', r.id!)
    setMsg(error ? { ok: false, text: 'Could not remove.' } : { ok: true, text: `Grade ${r.grade} removed.` })
    refresh()
  }

  async function loadStarter() {
    const { error } = await supabase!.from('grade_scale').insert(STARTER_SCALE.map((r) => ({ ...r, remark: r.remark || null })))
    setMsg(error ? { ok: false, text: 'Could not load the starter scale.' } : { ok: true, text: 'Starter scale loaded. Edit it to match your school.' })
    refresh()
  }

  const missing = rows.length > 0 ? gaps(rows) : []
  const input = 'rounded-lg border border-slate-300 p-3 text-base'
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Grading scale</h1>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
      {rows.length === 0 && (
        <button onClick={loadStarter} className="rounded-lg bg-brand p-3 font-semibold text-white">
          Load a starter scale (A to F), then edit it
        </button>
      )}
      {missing.length > 0 && (
        <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">No grade covers these scores: {missing.join(', ')}.</p>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
            <p><span className="mr-2 text-lg font-bold">{r.grade}</span>{r.min_score} to {r.max_score} <span className="text-slate-600">{r.remark}</span></p>
            <div className="flex gap-2 text-sm">
              <button onClick={() => { setEditing(r.id!); setF({ min: String(r.min_score), max: String(r.max_score), grade: r.grade, remark: r.remark }) }} className="rounded-lg border border-slate-300 px-3 py-2">Edit</button>
              <button onClick={() => remove(r)} className="rounded-lg border border-slate-300 px-3 py-2">Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={save} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">{editing ? 'Edit grade' : 'Add a grade'}</h2>
        <div className="grid grid-cols-2 gap-2">
          <input inputMode="decimal" placeholder="Lowest score" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} className={input} />
          <input inputMode="decimal" placeholder="Highest score" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} className={input} />
        </div>
        <input placeholder="Grade (A)" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} className={input} />
        <input placeholder="Remark (Excellent)" value={f.remark} onChange={(e) => setF({ ...f, remark: e.target.value })} className={input} />
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-brand p-3 font-semibold text-white">{editing ? 'Save changes' : 'Add grade'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setF({ min: '', max: '', grade: '', remark: '' }) }} className="rounded-lg border border-slate-300 px-4">Cancel</button>}
        </div>
      </form>
    </div>
  )
}

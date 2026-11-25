import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MOVEMENT_LABELS, validateMovement } from '../../lib/students'
import { formatDate } from '../../lib/terms'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'

type Row = {
  id: string; movement: string; moved_on: string; reason: string | null; created_at: string
  terms: { name: string; academic_years: { name: string } | { name: string }[] | null } | { name: string; academic_years: unknown }[] | null
}

const input = 'rounded-lg border border-slate-300 p-3 text-base'
const today = () => new Date().toISOString().slice(0, 10)

function termLabel(t: Row['terms']): string {
  const term = Array.isArray(t) ? t[0] : t
  if (!term) return ''
  const y = term.academic_years as { name: string } | { name: string }[] | null
  const year = Array.isArray(y) ? y[0]?.name : y?.name
  return `${term.name}${year ? ', ' + year : ''}`
}

// History of a student's movements, and (Admin only) the form to move them out or bring them back.
export default function Movements({ studentId, status, isAdmin, onChanged }: { studentId: string; status: string; isAdmin: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [f, setF] = useState({ movement: '', moved_on: today(), reason: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const active = status === 'active'

  const load = useCallback(async () => {
    const { data } = await supabase!
      .from('student_movements')
      .select('id, movement, moved_on, reason, created_at, terms(name, academic_years(name))')
      .eq('student_id', studentId)
      .order('moved_on', { ascending: false })
      .order('created_at', { ascending: false })
    setRows((data as unknown as Row[]) ?? [])
  }, [studentId])
  useEffect(() => { load() }, [load, status])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const movement = active ? f.movement : 'transfer_in'
    const v = validateMovement({ ...f, movement })
    if (!v.ok) return setMsg({ ok: false, text: v.error })
    const what = active ? MOVEMENT_LABELS[movement].toLowerCase() : 'return to school'
    if (!window.confirm(`Record: ${what}, on ${formatDate(f.moved_on)}? This will appear in the student's history and cannot be deleted.`)) return
    const { error } = await supabase!.rpc('record_movement', { p_student: studentId, p_movement: movement, p_moved_on: f.moved_on, p_reason: f.reason })
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not save.') })
    setF({ movement: '', moved_on: today(), reason: '' })
    setMsg({ ok: true, text: 'Recorded.' })
    onChanged()
    load()
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">History</h2>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium">{MOVEMENT_LABELS[r.movement] ?? r.movement} · {formatDate(r.moved_on)}</p>
            <p className="text-slate-600">{termLabel(r.terms)}{r.reason ? ` · ${r.reason}` : ''}</p>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-slate-600">No movements recorded yet.</li>}
      </ul>

      {isAdmin && (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-slate-200 pt-3">
          <h3 className="font-medium">{active ? 'Move this student out' : 'Bring this student back'}</h3>
          {active && (
            <select value={f.movement} onChange={(e) => setF({ ...f, movement: e.target.value })} className={input} aria-label="What happened">
              <option value="">What happened?</option>
              <option value="transfer_out">Transferred to another school</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="graduated">Graduated</option>
            </select>
          )}
          <input type="date" value={f.moved_on} onChange={(e) => setF({ ...f, moved_on: e.target.value })} className={input} aria-label="Date" />
          <input placeholder={f.movement === 'graduated' ? 'Note (optional)' : 'Reason'} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={input} />
          {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
          <button className="rounded-lg border border-slate-300 p-3 font-semibold">{active ? 'Record' : 'Record return'}</button>
        </form>
      )}
    </section>
  )
}

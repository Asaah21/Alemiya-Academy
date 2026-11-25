import { useCallback, useEffect, useState } from 'react'
import SnapshotView, { type SnapshotData } from '../features/termclose/SnapshotView'
import { weekLabel } from '../lib/weeks'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

type Term = { id: string; name: string; status: 'open' | 'closed'; start_date: string; end_date: string; is_current: boolean; academic_years: { name: string } | { name: string }[] | null }
type Check = { weeks_missing: { class_id: string; class_name: string; weeks: string[] }[]; scores_missing: { class_id: string; class_name: string; students: number; incomplete: number }[]; staff_days_missing: number }
type Snap = { data: SnapshotData; closed_at: string; reopened_reason: string | null }
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const hasGaps = (c: Check) => c.weeks_missing.length > 0 || c.scores_missing.length > 0 || c.staff_days_missing > 0

export default function TermClose() {
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [check, setCheck] = useState<Check | null>(null)
  const [accept, setAccept] = useState(false)
  const [snap, setSnap] = useState<Snap | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadTerms = useCallback(async () => {
    const { data } = await supabase!.from('terms').select('id, name, status, start_date, end_date, is_current, academic_years(name)').order('start_date', { ascending: false })
    setTerms((data as unknown as Term[]) ?? [])
  }, [])
  useEffect(() => { loadTerms() }, [loadTerms])

  const term = terms.find((t) => t.id === termId)

  useEffect(() => {
    setCheck(null); setAccept(false); setSnap(null); setMsg(null)
    if (!term || term.status !== 'closed') return
    supabase!.from('term_snapshots').select('data, closed_at, reopened_reason').eq('term_id', term.id).order('closed_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setSnap((data as Snap) ?? null))
  }, [term?.id, term?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runCheck() {
    setBusy(true); setMsg(null)
    const { data, error } = await supabase!.rpc('term_close_check', { p_term: termId })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: friendlyError(error) })
    setCheck(data as Check)
  }

  async function close() {
    if (!window.confirm(`Close ${term!.name}, ${yearName(term!)}? After this nobody can change its attendance, scores, remarks, fees or payments unless you reopen it.`)) return
    setBusy(true); setMsg(null)
    const { error } = await supabase!.rpc('close_term', { p_term: termId, p_accept_gaps: accept })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: friendlyError(error) })
    setMsg({ ok: true, text: 'Term closed and the snapshot saved. Remember to make the next term the current term under Setup, Years and terms.' })
    setCheck(null)
    loadTerms()
  }

  async function reopen() {
    const reason = window.prompt('Why are you reopening this term? (the reason is kept)')?.trim()
    if (!reason) return
    setBusy(true); setMsg(null)
    const { error } = await supabase!.rpc('reopen_term', { p_term: termId, p_reason: reason })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: friendlyError(error) })
    setMsg({ ok: true, text: 'Term reopened. Make your corrections, then close it again to save a new snapshot.' })
    loadTerms()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-brand">Close a term</h1>
      <p className="text-sm text-slate-600">Closing saves a read-only copy of the term's numbers and locks its records. Only the Admin can close or reopen a term.</p>
      <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
        <option value="">Choose the term</option>
        {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)} {t.status === 'closed' ? '(closed)' : ''}</option>)}
      </select>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}

      {term && term.status === 'open' && (
        <>
          <button onClick={runCheck} disabled={busy} className="rounded-lg border border-slate-300 p-3 font-medium disabled:opacity-60">Check the term for missing records</button>
          {check && (
            <div className="flex flex-col gap-3">
              {!hasGaps(check) && <p className="rounded-xl bg-green-100 p-4 text-sm text-green-900">Nothing is missing. The term is ready to close.</p>}
              {check.weeks_missing.length > 0 && (
                <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
                  <p className="font-medium">Attendance weeks not recorded:</p>
                  <ul className="list-disc pl-5">{check.weeks_missing.map((w) => <li key={w.class_id}>{w.class_name}: {w.weeks.length} week{w.weeks.length === 1 ? '' : 's'} ({w.weeks.slice(0, 3).map(weekLabel).join('; ')}{w.weeks.length > 3 ? '…' : ''})</li>)}</ul>
                </div>
              )}
              {check.scores_missing.length > 0 && (
                <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
                  <p className="font-medium">Scores missing:</p>
                  <ul className="list-disc pl-5">{check.scores_missing.map((s) => <li key={s.class_id}>{s.class_name}: {s.incomplete} of {s.students} students have missing scores</li>)}</ul>
                </div>
              )}
              {check.staff_days_missing > 0 && <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">Staff attendance was not recorded on {check.staff_days_missing} school day{check.staff_days_missing === 1 ? '' : 's'}.</p>}
              {hasGaps(check) && (
                <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 h-5 w-5" /> I know about these gaps and want to close the term anyway.</label>
              )}
              <button onClick={close} disabled={busy || (hasGaps(check) && !accept)} className="rounded-lg bg-brand p-3 font-semibold text-white disabled:opacity-50">Close this term</button>
            </div>
          )}
        </>
      )}

      {term && term.status === 'closed' && (
        <>
          <div className="rounded-xl bg-slate-100 p-4 text-sm">
            <p className="font-medium">This term is closed{snap ? ` (saved ${new Date(snap.closed_at).toLocaleDateString('en-GB')})` : ''}.</p>
            {snap?.reopened_reason && <p className="mt-1 text-slate-600">It was reopened once. Reason: {snap.reopened_reason}</p>}
          </div>
          <button onClick={reopen} disabled={busy} className="rounded-lg border border-red-300 p-3 font-medium text-red-700 disabled:opacity-60">Reopen this term (to correct a record)</button>
          {snap ? <SnapshotView data={snap.data} /> : <p className="text-slate-600">Loading the snapshot…</p>}
        </>
      )}
    </div>
  )
}

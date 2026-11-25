import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import { formatDate, validateTerm, validateYear } from '../lib/terms'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
type Term = { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; status: string; is_current: boolean }

const input = 'rounded-lg border border-slate-300 p-3 text-base'
const btn = 'rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-bold'

export default function Years() {
  const { reload } = useSchool()
  const [years, setYears] = useState<Year[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [yf, setYf] = useState({ name: '', start_date: '', end_date: '' })
  const [tf, setTf] = useState<Record<string, { name: string; start_date: string; end_date: string }>>({})

  const refresh = useCallback(async () => {
    const [y, t] = await Promise.all([
      supabase!.from('academic_years').select('*').order('start_date', { ascending: false }),
      supabase!.from('terms').select('*').order('start_date'),
    ])
    setYears((y.data as Year[]) ?? [])
    setTerms((t.data as Term[]) ?? [])
    reload()
  }, [reload])

  useEffect(() => { refresh() }, [refresh])

  const [editYear, setEditYear] = useState<Year | null>(null)
  const [editTerm, setEditTerm] = useState<Term | null>(null)

  const fail = (text: string) => setMsg({ ok: false, text })

  async function addYear(e: FormEvent) {
    e.preventDefault()
    const v = validateYear(yf)
    if (!v.ok) return fail(v.error)
    const { error } = await supabase!.from('academic_years').insert({ name: yf.name.trim(), start_date: yf.start_date, end_date: yf.end_date })
    if (error) return fail(error.code === '23505' ? 'This academic year already exists.' : friendlyError(error, 'Could not save the year.'))
    setYf({ name: '', start_date: '', end_date: '' })
    setMsg({ ok: true, text: 'Academic year added. Now add its terms.' })
    refresh()
  }

  async function addTerm(e: FormEvent, y: Year) {
    e.preventDefault()
    const f = tf[y.id] ?? { name: 'Term 1', start_date: '', end_date: '' }
    const v = validateTerm(f, y, terms.filter((t) => t.academic_year_id === y.id))
    if (!v.ok) return fail(v.error)
    const { error } = await supabase!.from('terms').insert({ academic_year_id: y.id, ...f })
    if (error) return fail(friendlyError(error, 'Could not save the term.'))
    setTf({ ...tf, [y.id]: { name: 'Term 1', start_date: '', end_date: '' } })
    setMsg({ ok: true, text: `${f.name} added.` })
    refresh()
  }

  async function makeCurrent(t: Term) {
    const { error } = await supabase!.rpc('set_current_term', { p_term_id: t.id })
    if (error) return fail(friendlyError(error, 'Could not change the current term.'))
    setMsg({ ok: true, text: `${t.name} is now the current term.` })
    refresh()
  }

  async function saveYear(e: FormEvent) {
    e.preventDefault()
    if (!editYear) return
    const v = validateYear(editYear)
    if (!v.ok) return fail(v.error)
    const mine = terms.filter((t) => t.academic_year_id === editYear.id)
    if (mine.some((t) => t.start_date < editYear.start_date || t.end_date > editYear.end_date)) return fail('The year must still cover all of its terms. Change the term dates first.')
    const { error } = await supabase!.from('academic_years').update({ name: editYear.name.trim(), start_date: editYear.start_date, end_date: editYear.end_date }).eq('id', editYear.id)
    if (error) return fail(friendlyError(error, 'Could not save the year.'))
    setEditYear(null)
    setMsg({ ok: true, text: 'Academic year saved.' })
    refresh()
  }

  async function saveTerm(e: FormEvent) {
    e.preventDefault()
    if (!editTerm) return
    const y = years.find((x) => x.id === editTerm.academic_year_id)!
    const v = validateTerm(editTerm, y, terms.filter((t) => t.academic_year_id === y.id))
    if (!v.ok) return fail(v.error)
    const { error } = await supabase!.from('terms').update({ name: editTerm.name, start_date: editTerm.start_date, end_date: editTerm.end_date }).eq('id', editTerm.id)
    if (error) return fail(friendlyError(error, 'Could not save the term.'))
    setEditTerm(null)
    setMsg({ ok: true, text: `${editTerm.name} saved.` })
    refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-brand">Academic years and terms</h1>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}

      <form onSubmit={addYear} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Add an academic year</h2>
        <input placeholder="2026/2027" value={yf.name} onChange={(e) => setYf({ ...yf, name: e.target.value })} className={input} />
        <label className="flex flex-col gap-1 text-sm font-medium">Starts<input type="date" value={yf.start_date} onChange={(e) => setYf({ ...yf, start_date: e.target.value })} className={input} /></label>
        <label className="flex flex-col gap-1 text-sm font-medium">Ends<input type="date" value={yf.end_date} onChange={(e) => setYf({ ...yf, end_date: e.target.value })} className={input} /></label>
        <button className="rounded-lg bg-brand p-3 font-semibold text-white">Add year</button>
      </form>

      {years.map((y) => {
        const yt = terms.filter((t) => t.academic_year_id === y.id)
        const f = tf[y.id] ?? { name: 'Term 1', start_date: '', end_date: '' }
        const setF = (patch: Partial<typeof f>) => setTf({ ...tf, [y.id]: { ...f, ...patch } })
        return (
          <section key={y.id} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">
              {y.name} <span className="font-normal text-slate-600">({formatDate(y.start_date)} to {formatDate(y.end_date)})</span>
              {y.is_current && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Current year</span>}
              <button onClick={() => setEditYear(editYear?.id === y.id ? null : y)} className={`${btn} ml-2`}>{editYear?.id === y.id ? 'Cancel' : 'Edit'}</button>
            </h2>
            {editYear?.id === y.id && (
              <form onSubmit={saveYear} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                <input aria-label="Year name" value={editYear.name} onChange={(e) => setEditYear({ ...editYear, name: e.target.value })} className={input} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" aria-label="Year starts" value={editYear.start_date} onChange={(e) => setEditYear({ ...editYear, start_date: e.target.value })} className={input} />
                  <input type="date" aria-label="Year ends" value={editYear.end_date} onChange={(e) => setEditYear({ ...editYear, end_date: e.target.value })} className={input} />
                </div>
                <button className="rounded-lg bg-brand p-3 font-bold text-white">Save year</button>
              </form>
            )}
            <ul className="flex flex-col gap-2">
              {yt.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold">{t.name} {t.is_current && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">Current term</span>} {t.status === 'closed' && <span className="ml-1 rounded-full bg-slate-300 px-2 py-0.5 text-xs">Closed</span>}</p>
                      <p className="text-sm text-slate-600">{formatDate(t.start_date)} to {formatDate(t.end_date)}</p>
                    </div>
                    <div className="flex gap-2">
                      {t.status !== 'closed' && <button onClick={() => setEditTerm(editTerm?.id === t.id ? null : t)} className={btn}>{editTerm?.id === t.id ? 'Cancel' : 'Edit'}</button>}
                      {!t.is_current && <button onClick={() => makeCurrent(t)} className={btn}>Make current</button>}
                    </div>
                  </div>
                  {editTerm?.id === t.id && (
                    <form onSubmit={saveTerm} className="flex flex-col gap-2 border-t border-slate-200 pt-2">
                      <select value={editTerm.name} onChange={(e) => setEditTerm({ ...editTerm, name: e.target.value })} className={input} aria-label="Term name">
                        <option>Term 1</option><option>Term 2</option><option>Term 3</option>
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" aria-label="Term starts" value={editTerm.start_date} onChange={(e) => setEditTerm({ ...editTerm, start_date: e.target.value })} className={input} />
                        <input type="date" aria-label="Term ends" value={editTerm.end_date} onChange={(e) => setEditTerm({ ...editTerm, end_date: e.target.value })} className={input} />
                      </div>
                      <button className="rounded-lg bg-brand p-3 font-bold text-white">Save term</button>
                    </form>
                  )}
                </li>
              ))}
              {yt.length === 0 && <li className="text-sm text-slate-600">No terms yet.</li>}
            </ul>
            <form onSubmit={(e) => addTerm(e, y)} className="flex flex-col gap-2 border-t border-slate-200 pt-3">
              <select value={f.name} onChange={(e) => setF({ name: e.target.value })} className={input}>
                <option>Term 1</option><option>Term 2</option><option>Term 3</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" aria-label="Term starts" value={f.start_date} onChange={(e) => setF({ start_date: e.target.value })} className={input} />
                <input type="date" aria-label="Term ends" value={f.end_date} onChange={(e) => setF({ end_date: e.target.value })} className={input} />
              </div>
              <button className={btn}>Add term</button>
            </form>
          </section>
        )
      })}
    </div>
  )
}

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import { formatDate, validateTerm, validateYear } from '../lib/terms'
import { supabase } from '../lib/supabase'

type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
type Term = { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; status: string; is_current: boolean }

const input = 'rounded-lg border border-slate-300 p-3 text-base'
const btn = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium'

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

  const fail = (text: string) => setMsg({ ok: false, text })

  async function addYear(e: FormEvent) {
    e.preventDefault()
    const v = validateYear(yf)
    if (!v.ok) return fail(v.error)
    const { error } = await supabase!.from('academic_years').insert({ name: yf.name.trim(), start_date: yf.start_date, end_date: yf.end_date })
    if (error) return fail(error.code === '23505' ? 'This academic year already exists.' : 'Could not save the year.')
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
    if (error) return fail('Could not save the term.')
    setTf({ ...tf, [y.id]: { name: 'Term 1', start_date: '', end_date: '' } })
    setMsg({ ok: true, text: `${f.name} added.` })
    refresh()
  }

  async function makeCurrent(t: Term) {
    const { error } = await supabase!.rpc('set_current_term', { p_term_id: t.id })
    if (error) return fail('Could not change the current term.')
    setMsg({ ok: true, text: `${t.name} is now the current term.` })
    refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Academic years and terms</h1>
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
            </h2>
            <ul className="flex flex-col gap-2">
              {yt.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="font-medium">{t.name} {t.is_current && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">Current term</span>}</p>
                    <p className="text-sm text-slate-600">{formatDate(t.start_date)} to {formatDate(t.end_date)}</p>
                  </div>
                  {!t.is_current && <button onClick={() => makeCurrent(t)} className={btn}>Make current</button>}
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

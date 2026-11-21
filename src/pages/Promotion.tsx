import { useEffect, useMemo, useState } from 'react'
import { defaultPromotionDate, nextClassMap, planPromotion, type PromoClass } from '../lib/promotion'
import { supabase } from '../lib/supabase'

type Year = { id: string; name: string }
type Term = { id: string; academic_year_id: string; status: string; end_date: string }
type Student = { id: string; full_name: string; class_id: string }
const input = 'rounded-lg border border-slate-300 p-3 text-base'

export default function Promotion() {
  const [years, setYears] = useState<Year[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<PromoClass[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [yearId, setYearId] = useState('')
  const [date, setDate] = useState('')
  const [repeaters, setRepeaters] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const [y, t, c, s] = await Promise.all([
      supabase!.from('academic_years').select('id, name').order('start_date', { ascending: false }),
      supabase!.from('terms').select('id, academic_year_id, status, end_date'),
      supabase!.from('classes').select('id, name, level_order').order('level_order'),
      supabase!.from('students').select('id, full_name, class_id').eq('status', 'active').order('full_name').range(0, 4999),
    ])
    setYears((y.data as Year[]) ?? []); setTerms((t.data as Term[]) ?? []); setClasses((c.data as PromoClass[]) ?? []); setStudents((s.data as Student[]) ?? [])
  }
  useEffect(() => { load() }, [])

  const yearTerms = terms.filter((t) => t.academic_year_id === yearId)
  const lastEnd = yearTerms.map((t) => t.end_date).sort().at(-1)
  const allClosed = yearTerms.length > 0 && yearTerms.every((t) => t.status === 'closed')
  useEffect(() => {
    setRepeaters(new Set()); setMsg(null)
    setDate(lastEnd ? defaultPromotionDate(lastEnd, new Date().toISOString().slice(0, 10)) : '')
  }, [yearId, lastEnd])

  const next = useMemo(() => nextClassMap(classes), [classes])
  const plan = planPromotion(classes, students, repeaters)
  const toggle = (id: string) => setRepeaters((r) => { const n = new Set(r); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function promote() {
    const year = years.find((y) => y.id === yearId)!
    if (!window.confirm(`Promote for ${year.name}? ${plan.promoted} move up, ${plan.repeated} repeat, ${plan.graduated} graduate. This cannot be undone from here.`)) return
    setBusy(true); setMsg(null)
    const { data, error } = await supabase!.rpc('promote_year', { p_year: yearId, p_repeaters: [...repeaters], p_moved_on: date })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    const r = (Array.isArray(data) ? data[0] : data) as { promoted: number; repeated: number; graduated: number }
    setMsg({ ok: true, text: `Done. ${r.promoted} moved up, ${r.repeated} repeat, ${r.graduated} graduated.` })
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Year-end promotion</h1>
      <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
        Before you promote: close every term of the year, and print or download the report cards. After promotion each child belongs to the new class, and the old report cards will no longer show on the parents' phones.
      </p>
      <select value={yearId} onChange={(e) => setYearId(e.target.value)} className={input} aria-label="Academic year">
        <option value="">Choose the year that has ended</option>
        {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
      </select>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}

      {yearId && !allClosed && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Every term of this year must be closed first. Use Setup, Close a term.</p>}

      {yearId && allClosed && (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium">Promotion date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <p className="text-sm text-slate-600">Tick "Repeats" for any child who stays in the same class.</p>
          {classes.map((c) => {
            const list = students.filter((s) => s.class_id === c.id)
            if (list.length === 0) return null
            return (
              <section key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="font-semibold">{c.name} <span className="font-normal text-slate-600">→ {next[c.id]?.name ?? 'Graduates'}</span></h2>
                <ul className="mt-2 flex flex-col gap-1">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                      <span>{s.full_name}</span>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={repeaters.has(s.id)} onChange={() => toggle(s.id)} className="h-5 w-5" /> Repeats</label>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          <p className="text-sm font-medium">{plan.promoted} move up · {plan.repeated} repeat · {plan.graduated} graduate</p>
          <button onClick={promote} disabled={busy || !date} className="rounded-lg bg-brand p-3 font-semibold text-white disabled:opacity-50">Promote the students</button>
        </>
      )}
    </div>
  )
}

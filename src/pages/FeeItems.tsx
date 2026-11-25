import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import { formatMoney, itemsToCopy, totalFees, validateFeeItem, type FeeItem } from '../lib/fees'
import { supabase } from '../lib/supabase'

type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'

export default function FeeItems() {
  const { currentTerm } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [items, setItems] = useState<FeeItem[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase!.from('classes').select('id, name').order('level_order'),
      supabase!.from('terms').select('id, name, academic_years(name)').order('start_date', { ascending: false }),
    ]).then(([c, t]) => { setClasses(c.data ?? []); setTerms((t.data as unknown as Term[]) ?? []) })
  }, [])
  useEffect(() => { if (!termId && currentTerm) setTermId(currentTerm.id) }, [currentTerm, termId])

  const refresh = useCallback(async () => {
    if (!classId || !termId) return setItems([])
    const { data } = await supabase!.from('fee_items').select('id, class_id, term_id, name, amount').eq('class_id', classId).eq('term_id', termId).order('created_at')
    setItems(((data ?? []) as FeeItem[]).map((i) => ({ ...i, amount: Number(i.amount) })))
  }, [classId, termId])
  useEffect(() => { setMsg(null); refresh() }, [refresh])

  async function add(e: FormEvent) {
    e.preventDefault()
    const v = validateFeeItem(name, amount)
    if (!v.ok) return setMsg({ ok: false, text: v.error })
    if (items.some((i) => i.name.toLowerCase() === v.name.toLowerCase())) return setMsg({ ok: false, text: 'This fee is already on the list. Change its amount instead.' })
    const { error } = await supabase!.from('fee_items').insert({ class_id: classId, term_id: termId, name: v.name, amount: v.amount })
    if (error) return setMsg({ ok: false, text: 'Could not save. Please try again.' })
    setName(''); setAmount(''); setMsg({ ok: true, text: `${v.name} added.` }); refresh()
  }

  async function change(i: FeeItem) {
    const text = window.prompt(`New amount for ${i.name} (in cedis)`, String(i.amount))
    if (text === null) return
    const v = validateFeeItem(i.name, text)
    if (!v.ok) return setMsg({ ok: false, text: v.error })
    if (v.amount === i.amount) return
    const { error } = await supabase!.from('fee_items').update({ amount: v.amount }).eq('id', i.id)
    setMsg(error ? { ok: false, text: 'Could not save.' } : { ok: true, text: `${i.name} is now ${formatMoney(v.amount)}. Balances change with it.` })
    refresh()
  }

  async function remove(i: FeeItem) {
    if (!window.confirm(`Remove ${i.name} from this class and term? Balances will change.`)) return
    const { error } = await supabase!.from('fee_items').delete().eq('id', i.id)
    setMsg(error ? { ok: false, text: 'Could not remove.' } : { ok: true, text: `${i.name} removed.` })
    refresh()
  }

  async function copy() {
    if (!copyFrom) return setMsg({ ok: false, text: 'Choose the term to copy from.' })
    const { data, error } = await supabase!.from('fee_items').select('name, amount').eq('class_id', classId).eq('term_id', copyFrom)
    if (error) return setMsg({ ok: false, text: 'Could not read that term.' })
    const rows = itemsToCopy((data ?? []).map((r) => ({ name: r.name, amount: Number(r.amount) })), items)
    if (rows.length === 0) return setMsg({ ok: false, text: 'Nothing to copy. That term has no fees for this class, or they are already here.' })
    const ins = await supabase!.from('fee_items').insert(rows.map((r) => ({ ...r, class_id: classId, term_id: termId })))
    setMsg(ins.error ? { ok: false, text: 'Could not copy.' } : { ok: true, text: `${rows.length} fee${rows.length === 1 ? '' : 's'} copied.` })
    refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-brand">Fees</h1>
      <p className="text-sm text-slate-600">Set what each class pays in a term. Every active student in the class owes the total.</p>
      <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
        <option value="">Choose the term</option>
        {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
      </select>
      <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
        <option value="">Choose the class</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}

      {classId && termId && (
        <>
          <ul className="flex flex-col gap-2">
            {items.length === 0 && <li className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No fees set for this class and term yet.</li>}
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
                <p><span className="block font-medium">{i.name}</span><span className="text-sm text-slate-600">{formatMoney(i.amount)}</span></p>
                <span className="flex gap-2">
                  <button onClick={() => change(i)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Change</button>
                  <button onClick={() => remove(i)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">Remove</button>
                </span>
              </li>
            ))}
            {items.length > 0 && <li className="rounded-xl bg-slate-100 p-3 text-right font-bold">Total per student: {formatMoney(totalFees(items))}</li>}
          </ul>
          <form onSubmit={add} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Add a fee</h2>
            <input placeholder="School fees" value={name} onChange={(e) => setName(e.target.value)} className={input} />
            <input placeholder="Amount in cedis, e.g. 250" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} />
            <button className="rounded-lg bg-brand p-3 font-semibold text-white">Add fee</button>
          </form>
          <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Copy from another term</h2>
            <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={input} aria-label="Copy from term">
              <option value="">Choose the term to copy from</option>
              {terms.filter((t) => t.id !== termId).map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
            </select>
            <button onClick={copy} className="rounded-lg border border-slate-300 p-3 font-medium">Copy this class's fees</button>
          </div>
        </>
      )}
    </div>
  )
}

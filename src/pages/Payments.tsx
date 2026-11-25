import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import Receipt, { type ReceiptData } from '../features/fees/Receipt'
import { useSchool } from '../features/school/SchoolProvider'
import { formatMoney, totalFees } from '../lib/fees'
import { balanceOf, receiptDate, validatePayment, wouldOverpay, type Payment } from '../lib/payments'
import { filterStudents } from '../lib/students'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

type Student = { id: string; admission_no: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; class_id: string | null; status: string }
type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }
const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const today = () => new Date().toISOString().slice(0, 10)

export default function Payments() {
  const { state } = useAuth()
  const me = state.status === 'ready' ? state.profile.full_name : ''
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const { schoolName, currentTerm } = useSchool()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [location, setLocation] = useState('')
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [student, setStudent] = useState<Student | null>(null)
  const [owed, setOwed] = useState(0)
  const [payments, setPayments] = useState<Payment[]>([])
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  useEffect(() => {
    Promise.all([
      supabase!.from('students').select('id, admission_no, full_name, guardian_name, guardian_phone, class_id, status').eq('status', 'active').order('full_name'),
      supabase!.from('classes').select('id, name').order('level_order'),
      supabase!.from('terms').select('id, name, academic_years(name)').order('start_date', { ascending: false }),
      supabase!.from('settings').select('location').maybeSingle(),
    ]).then(([s, c, t, st]) => {
      setStudents((s.data as Student[]) ?? [])
      setClasses(c.data ?? [])
      setTerms((t.data as unknown as Term[]) ?? [])
      setLocation(st.data?.location ?? '')
    })
  }, [])
  useEffect(() => { if (!termId && currentTerm) setTermId(currentTerm.id) }, [currentTerm, termId])

  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])
  const termLabel = useMemo(() => { const t = terms.find((x) => x.id === termId); return t ? `${t.name}, ${yearName(t)}` : '' }, [terms, termId])
  const found = useMemo(() => (search.trim().length >= 2 || classId ? filterStudents(students, { search, classId, status: 'active' }).slice(0, 30) as Student[] : []), [students, search, classId])

  const load = useCallback(async () => {
    if (!student || !termId) return
    const [fees, pays] = await Promise.all([
      student.class_id ? supabase!.from('fee_items').select('amount').eq('class_id', student.class_id).eq('term_id', termId) : Promise.resolve({ data: [], error: null }),
      supabase!.from('payments').select('id, student_id, term_id, amount, paid_on, receipt_no, note, status, received_by, void_reason').eq('student_id', student.id).eq('term_id', termId).order('created_at', { ascending: false }),
    ])
    if (fees.error || pays.error) return setMsg({ ok: false, text: 'Could not load the fees. Please try again.' })
    setOwed(totalFees((fees.data ?? []).map((f) => ({ amount: Number(f.amount) }))))
    setPayments(((pays.data ?? []) as Payment[]).map((p) => ({ ...p, amount: Number(p.amount) })))
  }, [student, termId])
  useEffect(() => { setReceipt(null); setPayments([]); setOwed(0); load() }, [load])

  const bal = balanceOf(owed, payments)

  function receiptFor(p: Payment, balanceAfter: number | null, receivedBy: string): ReceiptData {
    return {
      receiptNo: p.receipt_no, schoolName, location, studentName: student!.full_name, admissionNo: student!.admission_no,
      className: student!.class_id ? className.get(student!.class_id) ?? '' : '', termLabel, amount: p.amount, paidOn: p.paid_on,
      note: p.note, receivedBy, balanceAfter, voided: p.status === 'void',
    }
  }

  async function record(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    const v = validatePayment(amount, paidOn, today())
    if (!v.ok) return setMsg({ ok: false, text: v.error })
    if (owed === 0 && !window.confirm('No fees are set for this class and term, so the student owes nothing. Record the payment anyway?')) return
    if (owed > 0 && wouldOverpay(bal, v.amount) && !window.confirm(`This is more than the balance of ${formatMoney(Math.max(bal.balance, 0))}. Record it anyway?`)) return
    setBusy(true)
    const { data, error } = await supabase!.rpc('record_payment', { p_student: student!.id, p_term: termId, p_amount: v.amount, p_paid_on: paidOn, p_note: note.trim() || null })
    setBusy(false)
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row) return setMsg({ ok: false, text: error?.message ?? 'Could not save the payment. Please try again.' })
    const p: Payment = { id: row.payment_id, student_id: student!.id, term_id: termId, amount: v.amount, paid_on: paidOn, receipt_no: row.receipt_no, note: note.trim() || null, status: 'valid', received_by: null }
    setReceipt(receiptFor(p, bal.balance - v.amount, me))
    setAmount(''); setNote('')
    load()
  }

  async function voidPayment(p: Payment) {
    const reason = window.prompt(`Void receipt ${p.receipt_no} (${formatMoney(p.amount)})? Give the reason. This cannot be undone.`)?.trim()
    if (reason === undefined || reason === '') return
    if (reason.length < 3) return setMsg({ ok: false, text: 'Please give a reason of at least 3 letters.' })
    const { error } = await supabase!.rpc('void_payment', { p_payment: p.id, p_reason: reason })
    setMsg(error ? { ok: false, text: friendlyError(error) } : { ok: true, text: `Receipt ${p.receipt_no} voided. Record the correct payment if needed.` })
    setReceipt(null)
    load()
  }

  async function reprint(p: Payment) {
    let by = ''
    if (p.received_by && state.status === 'ready' && p.received_by === state.session.user.id) by = me
    else if (p.received_by) {
      const { data } = await supabase!.from('profiles').select('full_name').eq('auth_user_id', p.received_by).maybeSingle()
      by = data?.full_name ?? ''
    }
    setReceipt(receiptFor(p, null, by))
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-brand">Fees</h1>
          <span className="flex gap-3 text-sm underline">
            <Link to="/fees/balances">Balances</Link>
            {isAdmin && <Link to="/fees/cash">Daily cash</Link>}
          </span>
        </div>
        {!student ? (
          <>
            <input placeholder="Search by name or admission number" value={search} onChange={(e) => setSearch(e.target.value)} className={input} aria-label="Search students" />
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {found.length === 0 && <p className="text-slate-600">Type at least 2 letters of a name, or choose a class.</p>}
            <ul className="flex flex-col gap-2">
              {found.map((s) => (
                <li key={s.id}>
                  <button onClick={() => { setStudent(s); setMsg(null) }} className="w-full rounded-xl bg-white p-3 text-left shadow-sm">
                    <span className="block font-medium">{s.full_name}</span>
                    <span className="text-sm text-slate-600">{s.admission_no} · {s.class_id ? className.get(s.class_id) : 'No class'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
              <p><span className="block font-semibold">{student.full_name}</span><span className="text-sm text-slate-600">{student.admission_no} · {student.class_id ? className.get(student.class_id) : 'No class'}</span></p>
              <button onClick={() => { setStudent(null); setReceipt(null); setMsg(null) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Change</button>
            </div>
            <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-600">Owes</p><p className="font-bold">{formatMoney(bal.owed)}</p></div>
              <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-600">Paid</p><p className="font-bold">{formatMoney(bal.paid)}</p></div>
              <div className={`rounded-xl p-3 shadow-sm ${bal.balance > 0 ? 'bg-amber-100' : 'bg-green-100'}`}><p className="text-xs text-slate-600">{bal.balance < 0 ? 'Ahead by' : 'Balance'}</p><p className="font-bold">{formatMoney(Math.abs(bal.balance))}</p></div>
            </div>
            {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
            <form onSubmit={record} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Record a payment</h2>
              <input placeholder="Amount received in cedis" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} aria-label="Amount" />
              <input type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={input} aria-label="Date of payment" />
              <input placeholder="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
              <button disabled={busy} className="rounded-lg bg-brand p-3 font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Record payment and make receipt'}</button>
            </form>
            <section>
              <h2 className="mb-2 font-semibold">Payments this term</h2>
              <ul className="flex flex-col gap-2">
                {payments.length === 0 && <li className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No payments yet.</li>}
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                    <div>
                    <p className={p.status === 'void' ? 'text-slate-400 line-through' : ''}><span className="block font-medium">{formatMoney(p.amount)}</span><span className="text-sm">{p.receipt_no} · {receiptDate(p.paid_on)}</span></p>
                    {p.status === 'void' && p.void_reason && <p className="text-xs text-red-700">Voided: {p.void_reason}</p>}
                    </div>
                    <span className="flex gap-2">
                      <button onClick={() => reprint(p)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Receipt</button>
                      {isAdmin && p.status === 'valid' && <button onClick={() => voidPayment(p)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">Void</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>

      {receipt && (
        <div className="flex flex-col gap-3">
          <div className="print:hidden rounded-xl bg-green-100 p-4 text-sm text-green-900">Receipt {receipt.receiptNo} is ready. Print it and give it to the parent.</div>
          <Receipt r={receipt} />
          <div className="flex gap-2 print:hidden">
            <button onClick={() => window.print()} className="flex-1 rounded-lg bg-brand p-3 font-semibold text-white">Print receipt</button>
            <button onClick={() => setReceipt(null)} className="rounded-lg border border-slate-300 px-4 py-3 font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

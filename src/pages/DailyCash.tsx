import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { summariseCash, type CashPayment } from '../lib/balances'
import { formatMoney } from '../lib/fees'
import { receiptDate } from '../lib/payments'
import { supabase } from '../lib/supabase'

const today = () => new Date().toISOString().slice(0, 10)
const input = 'rounded-lg border border-slate-300 p-3 text-base'
type Row = CashPayment & { student: string }

export default function DailyCash() {
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState<Row[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    supabase!.from('profiles').select('auth_user_id, full_name').then(({ data }) => setNames(new Map((data ?? []).map((p) => [p.auth_user_id as string, p.full_name as string]))))
  }, [])

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setError(false)
    supabase!.from('payments').select('id, amount, receipt_no, status, received_by, student_id, students(full_name)').eq('paid_on', date).order('receipt_no').then(({ data, error: e }) => {
      if (e) setError(true)
      setRows(((data ?? []) as unknown as (Omit<Row, 'student'> & { students: { full_name: string } | { full_name: string }[] | null })[]).map((r) => ({
        id: r.id, amount: Number(r.amount), receipt_no: r.receipt_no, status: r.status, received_by: r.received_by, student_id: r.student_id,
        student: (Array.isArray(r.students) ? r.students[0]?.full_name : r.students?.full_name) ?? '',
      })))
      setLoading(false)
    })
  }, [date])

  const sum = useMemo(() => summariseCash(rows, names), [rows, names])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Daily cash</h1>
        <Link to="/fees/balances" className="text-sm underline">Balances</Link>
      </div>
      <input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={`${input} print:hidden`} aria-label="Date" />
      {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Could not load the payments. Please try again.</p>}
      {loading && <p className="text-slate-600">Loading…</p>}
      {date && !loading && !error && (
        <>
          <h2 className="font-semibold">{receiptDate(date)}</h2>
          <div className="rounded-xl bg-green-100 p-4 text-center">
            <p className="text-sm text-slate-700">Cash to hand over ({sum.count} payment{sum.count === 1 ? '' : 's'})</p>
            <p className="text-3xl font-bold">{formatMoney(sum.total)}</p>
          </div>
          {sum.byReceiver.length > 0 && (
            <ul className="flex flex-col gap-2">
              {sum.byReceiver.map((r) => <li key={r.receiver} className="flex justify-between rounded-xl bg-white p-3 shadow-sm"><span>Received by {r.receiver} ({r.count})</span><strong>{formatMoney(r.total)}</strong></li>)}
            </ul>
          )}
          {sum.voidedCount > 0 && <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">{sum.voidedCount} voided payment{sum.voidedCount === 1 ? '' : 's'} ({formatMoney(sum.voidedTotal)}) are not counted.</p>}
          {rows.length === 0 ? <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No payments on this day.</p> : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                  <p className={r.status === 'void' ? 'text-slate-400 line-through' : ''}><span className="block font-medium">{r.student}</span><span className="text-sm">{r.receipt_no}</span></p>
                  <strong className={r.status === 'void' ? 'text-slate-400 line-through' : ''}>{formatMoney(r.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => window.print()} className="rounded-lg border border-slate-300 p-3 font-medium print:hidden">Print</button>
        </>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { downloadPdf } from '../features/reportcard/pdf'
import ReportCard from '../features/reportcard/ReportCard'
import { formatMoney } from '../lib/fees'
import { noticeDate } from '../lib/notices'
import { cardFromParentReport, type ParentReport } from '../lib/parent-view'
import { receiptDate } from '../lib/payments'
import type { CardData } from '../lib/report-card'
import { supabase } from '../lib/supabase'

type Tab = 'results' | 'fees' | 'attendance' | 'notices'
type ResultTerm = { term_id: string; term_name: string; year_name: string }
type FeeTerm = { term_id: string; term_name: string; year_name: string; owed: number; paid: number; balance: number }
type Fees = { terms: FeeTerm[]; payments: { receipt_no: string; amount: number; paid_on: string; term_name: string }[] }
type Att = { term_name: string; year_name: string; school_days: number | string; days_absent: number | string }
const A4_PX = 794
const tabBtn = (on: boolean) => `flex-1 rounded-lg p-3 text-center font-medium ${on ? 'bg-brand text-white' : 'bg-white shadow-sm'}`

function Results() {
  const [terms, setTerms] = useState<ResultTerm[] | null>(null)
  const [termId, setTermId] = useState('')
  const [card, setCard] = useState<CardData | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scale, setScale] = useState(1)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase!.rpc('parent_result_terms').then(({ data, error: e }) => {
      if (e) return setError(true)
      const list = (data ?? []) as ResultTerm[]
      setTerms(list)
      if (list[0]) setTermId(list[0].term_id)
    })
  }, [])
  useEffect(() => {
    if (!termId) return
    setCard(null)
    setError(false)
    supabase!.rpc('parent_report', { p_term: termId }).then(({ data, error: e }) => (e || !data ? setError(true) : setCard(cardFromParentReport(data as ParentReport))))
  }, [termId])
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 32) / A4_PX))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  async function pdf() {
    const el = ref.current?.querySelector<HTMLElement>('[data-report-card]')
    if (!el || !card) return
    setBusy(true)
    try {
      await downloadPdf([el], `Report-${card.studentName.replace(/[^A-Za-z0-9]+/g, '-')}-${card.termName.replace(/\s+/g, '')}.pdf`)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Something went wrong. Please try again.</p>
  if (terms === null) return <p className="text-slate-600">Loading…</p>
  if (terms.length === 0) return <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No results have been published yet. Please check again later.</p>
  return (
    <div className="flex flex-col gap-3">
      <select value={termId} onChange={(e) => setTermId(e.target.value)} className="rounded-lg border border-slate-300 p-3 text-base print:hidden" aria-label="Term">
        {terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.term_name}, {t.year_name}</option>)}
      </select>
      {card && (
        <>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => window.print()} className="flex-1 rounded-lg border border-slate-300 p-3 font-medium">Print</button>
            <button onClick={pdf} disabled={busy} className="flex-1 rounded-lg border border-slate-300 p-3 font-medium disabled:opacity-60">{busy ? 'Preparing…' : 'Download PDF'}</button>
          </div>
          <div className="overflow-hidden print:overflow-visible">
            <div ref={ref} data-rc-scale style={{ width: A4_PX, transform: `scale(${scale})`, transformOrigin: 'top left', height: `${1123 * scale}px` }}>
              <ReportCard card={card} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FeesTab() {
  const [fees, setFees] = useState<Fees | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    supabase!.rpc('parent_fees').then(({ data, error: e }) => (e || !data ? setError(true) : setFees(data as Fees)))
  }, [])
  if (error) return <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Something went wrong. Please try again.</p>
  if (!fees) return <p className="text-slate-600">Loading…</p>
  const due = Math.round(fees.terms.reduce((s, t) => s + Number(t.balance), 0) * 100) / 100
  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-xl p-4 text-center ${due > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
        <p className="text-sm text-slate-700">{due > 0 ? 'Still to pay (all terms)' : due < 0 ? 'Paid ahead' : 'Nothing owed'}</p>
        <p className="text-3xl font-bold">{formatMoney(Math.abs(due))}</p>
      </div>
      {fees.terms.length === 0 && <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No fees have been set yet.</p>}
      <ul className="flex flex-col gap-2">
        {fees.terms.map((t) => (
          <li key={t.term_id} className="rounded-xl bg-white p-3 shadow-sm">
            <p className="font-medium">{t.term_name}, {t.year_name}</p>
            <p className="text-sm text-slate-600">Fees {formatMoney(Number(t.owed))} · Paid {formatMoney(Number(t.paid))} · {Number(t.balance) > 0 ? <strong>Owes {formatMoney(Number(t.balance))}</strong> : 'Fully paid'}</p>
          </li>
        ))}
      </ul>
      {fees.payments.length > 0 && (
        <>
          <h2 className="font-semibold">Payments received</h2>
          <ul className="flex flex-col gap-2">
            {fees.payments.map((p) => (
              <li key={p.receipt_no} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                <p><span className="block font-medium">{formatMoney(Number(p.amount))}</span><span className="text-sm text-slate-600">{p.receipt_no} · {receiptDate(p.paid_on)} · {p.term_name}</span></p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

type ParentNotice = { id: string; title: string; body: string; created_at: string; posted_by_name: string | null }

function NoticesTab() {
  const [rows, setRows] = useState<ParentNotice[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    supabase!.rpc('parent_notices').then(({ data, error: e }) => (e ? setError(true) : setRows((data ?? []) as ParentNotice[])))
  }, [])
  if (error) return <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Something went wrong. Please try again.</p>
  if (!rows) return <p className="text-slate-600">Loading…</p>
  if (rows.length === 0) return <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">There are no notices from the school right now.</p>
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((n) => (
        <li key={n.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-bold text-slate-900">{n.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{n.body}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{n.posted_by_name || 'School'} · {noticeDate(n.created_at)}</p>
        </li>
      ))}
    </ul>
  )
}

function AttendanceTab() {
  const [rows, setRows] = useState<Att[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    supabase!.rpc('parent_attendance').then(({ data, error: e }) => (e ? setError(true) : setRows((data ?? []) as Att[])))
  }, [])
  if (error) return <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Something went wrong. Please try again.</p>
  if (!rows) return <p className="text-slate-600">Loading…</p>
  if (rows.length === 0) return <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No attendance has been recorded yet.</p>
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const days = Number(r.school_days)
        const absent = Number(r.days_absent)
        return (
          <li key={`${r.term_name}${r.year_name}`} className="rounded-xl bg-white p-3 shadow-sm">
            <p className="font-medium">{r.term_name}, {r.year_name}</p>
            <p className="text-sm text-slate-600">Present {days - absent} of {days} school days · Absent {absent}</p>
          </li>
        )
      })}
    </ul>
  )
}

export default function ParentHome() {
  const { state, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('results')
  if (state.status === 'loading') return <p className="p-6 text-slate-600">Loading…</p>
  if (state.status !== 'parent') return <Navigate to="/parent" replace />
  const c = state.child
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4 print:max-w-none print:p-0">
      <header className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-brand">{c.schoolName || 'Alemiya Academy'}</h1>
        <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Log out</button>
      </header>
      <section className="rounded-xl bg-white p-4 shadow-sm print:hidden">
        <p className="text-3xl font-extrabold text-brand">{c.fullName}</p>
        <p className="text-slate-600">{c.className} · {c.admissionNo}</p>
      </section>
      <nav className="flex gap-2 print:hidden">
        <button onClick={() => setTab('results')} className={tabBtn(tab === 'results')}>Report card</button>
        <button onClick={() => setTab('fees')} className={tabBtn(tab === 'fees')}>Fees</button>
        <button onClick={() => setTab('attendance')} className={tabBtn(tab === 'attendance')}>Attendance</button>
        <button onClick={() => setTab('notices')} className={tabBtn(tab === 'notices')}>Notices</button>
      </nav>
      {tab === 'results' && <Results />}
      {tab === 'fees' && <FeesTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'notices' && <NoticesTab />}
    </main>
  )
}

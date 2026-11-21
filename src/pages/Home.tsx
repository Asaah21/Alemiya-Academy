import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { menuFor } from '../features/nav/menu'
import { balanceTotals, type BalanceRow } from '../lib/balances'
import { formatMoney } from '../lib/fees'
import { cashTotal, classesMissingAttendance, type HomeClass } from '../lib/home'
import { supabase } from '../lib/supabase'
import { mondayOf, weekLabel } from '../lib/weeks'

type Numbers = { students: number; term: string | null; missing: HomeClass[]; cash: number | null; due: number | null }
const card = 'rounded-xl bg-white p-4 shadow-sm'

export default function Home() {
  const { state } = useAuth()
  const [n, setN] = useState<Numbers | null>(null)
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'

  useEffect(() => {
    if (state.status !== 'ready') return
    const today = new Date().toISOString().slice(0, 10)
    const monday = mondayOf(today)
    ;(async () => {
      const [stu, term, classes, weeks] = await Promise.all([
        supabase!.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase!.from('terms').select('id, name').eq('is_current', true).maybeSingle(),
        supabase!.from('classes').select('id, name').order('level_order'),
        supabase!.from('attendance_weeks').select('class_id').eq('week_start', monday),
      ])
      let cash: number | null = null
      let due: number | null = null
      if (isAdmin) {
        const pay = await supabase!.from('payments').select('amount, status').eq('paid_on', today)
        cash = cashTotal((pay.data ?? []) as { amount: number; status: string }[])
        if (term.data) {
          const bal = await supabase!.rpc('fee_balances', { p_term: term.data.id })
          due = balanceTotals((bal.data ?? []) as BalanceRow[]).due
        }
      }
      setN({
        students: stu.count ?? 0,
        term: (term.data as { name: string } | null)?.name ?? null,
        missing: classesMissingAttendance((classes.data ?? []) as HomeClass[], (weeks.data ?? []).map((w) => w.class_id as string)),
        cash, due,
      })
    })()
  }, [state.status, isAdmin])

  if (state.status !== 'ready') return null
  const { profile } = state
  const items = menuFor(profile.role).filter((m) => m.path !== '/')
  const monday = mondayOf(new Date().toISOString().slice(0, 10))

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Welcome, {profile.full_name}</h1>
      {n && (
        <div className="grid grid-cols-2 gap-3">
          <div className={card}><p className="text-2xl font-bold">{n.students}</p><p className="text-sm text-slate-600">Students in school</p></div>
          <div className={card}><p className="text-lg font-bold">{n.term ?? 'No current term'}</p><p className="text-sm text-slate-600">Current term</p></div>
          {isAdmin && n.cash !== null && <div className={card}><p className="text-xl font-bold">{formatMoney(n.cash)}</p><p className="text-sm text-slate-600">Cash received today</p></div>}
          {isAdmin && n.due !== null && <Link to="/fees/balances" className={card}><p className="text-xl font-bold">{formatMoney(n.due)}</p><p className="text-sm text-slate-600">Fees still owed</p></Link>}
        </div>
      )}
      {n && n.term && (
        <div className={card}>
          <p className="font-medium">Attendance for the week of {weekLabel(monday)}</p>
          {n.missing.length === 0
            ? <p className="mt-1 text-sm text-green-800">Every class has been recorded.</p>
            : <p className="mt-1 text-sm text-amber-900">Not yet recorded: {n.missing.map((c) => c.name).join(', ')}. <Link to="/attendance" className="underline">Record now</Link></p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {items.map((m) => (
          <Link key={m.path} to={m.path} className="rounded-xl bg-white p-5 text-center font-medium shadow-sm">
            {m.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

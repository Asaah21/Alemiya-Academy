import { useEffect, useMemo, useState } from 'react'
import { Banknote, Coins, FileSpreadsheet, Percent, Receipt, Scale, Wallet } from 'lucide-react'
import { ActionGrid, ErrorNote, PageHeader, Panel, Stat, StatGrid, type Action } from '../components/ui'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'
import { balanceTotals, type BalanceRow } from '../lib/balances'
import { formatMoney } from '../lib/fees'
import { cashTotal } from '../lib/home'
import { supabase } from '../lib/supabase'

type Cls = { id: string; name: string }

export default function FeesHub() {
  const { state } = useAuth()
  const { currentTerm } = useSchool()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const [rows, setRows] = useState<BalanceRow[] | null>(null)
  const [classes, setClasses] = useState<Cls[]>([])
  const [today, setToday] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isAdmin || !currentTerm) return
    const day = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase!.rpc('fee_balances', { p_term: currentTerm.id }),
      supabase!.from('classes').select('id, name').order('level_order'),
      supabase!.from('payments').select('amount, status').eq('paid_on', day),
    ]).then(([b, c, p]) => {
      if (b.error || c.error || p.error) return setError(true)
      setRows(((b.data ?? []) as BalanceRow[]).map((r) => ({ ...r, owed: Number(r.owed), paid: Number(r.paid), balance: Number(r.balance), arrears: Number(r.arrears) })))
      setClasses((c.data ?? []) as Cls[])
      setToday(cashTotal((p.data ?? []) as { amount: number; status: string }[]))
    })
  }, [isAdmin, currentTerm])

  const totals = useMemo(() => (rows ? balanceTotals(rows) : null), [rows])
  const byClass = useMemo(() => classes.map((c) => ({ ...c, t: balanceTotals((rows ?? []).filter((r) => r.class_id === c.id)) })).filter((c) => c.t.students > 0), [classes, rows])

  const actions: (Action & { admin?: boolean })[] = [
    { to: '/fees/balances', label: 'Fee balances', hint: 'Owed by each student or class', icon: Scale },
    { to: '/fees/cash', label: 'Daily cash', hint: 'Money received each day', icon: Coins, admin: true },
    { to: '/setup/fees', label: 'Add or change fees', hint: 'What each class pays', icon: Wallet, admin: true },
    { to: '/reports/summary', label: 'Fee reports', hint: 'Filter, Excel, print', icon: FileSpreadsheet, admin: true },
  ]
  const money = (n: number | null | undefined) => (n == null ? '–' : formatMoney(n))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fees" subtitle={currentTerm ? `${currentTerm.name}, ${currentTerm.year_name}` : 'Payments and balances'} action={{ to: '/fees', label: 'Record a payment', icon: Receipt }} />
      <ErrorNote show={error} />
      {isAdmin && (
        <StatGrid>
          <Stat icon={Banknote} label="Total collected this term" value={money(totals?.paid)} />
          <Stat icon={Wallet} label="Total still owed" value={money(totals?.due)} hint="Including earlier arrears" to="/fees/balances" />
          <Stat icon={Coins} label="Collected today" value={money(today)} to="/fees/cash" />
          <Stat icon={Percent} label="Collection rate" value={totals ? (totals.collectionRate === null ? '–' : `${totals.collectionRate}%`) : '–'} hint={totals ? `${totals.owing} of ${totals.students} students owe` : undefined} />
        </StatGrid>
      )}
      <ActionGrid actions={actions.filter((a) => !a.admin || isAdmin)} />
      {isAdmin && (
        <Panel title="Fees by class" link={{ to: '/fees/balances', label: 'Each student' }}>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3 font-bold">Class</th><th className="px-3 py-3 text-right font-bold">Students</th><th className="px-3 py-3 text-right font-bold">Expected</th><th className="px-3 py-3 text-right font-bold">Collected</th><th className="px-5 py-3 text-right font-bold">Still owed</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows && <tr><td colSpan={5} className="px-5 py-4 font-medium text-slate-500">{currentTerm ? 'Loading…' : 'Set the current term to see fees.'}</td></tr>}
              {byClass.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-bold text-slate-900">{c.name}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{c.t.students}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatMoney(c.t.owed)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatMoney(c.t.paid)}</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{formatMoney(c.t.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}

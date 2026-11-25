import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, ChevronRight, ClipboardCheck, FileText, GraduationCap, Landmark, MapPin, Receipt, UserCog, UserPlus, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { balanceTotals, type BalanceRow } from '../lib/balances'
import { fetchAll } from '../lib/backup'
import { formatMoney } from '../lib/fees'
import { cashTotal } from '../lib/home'
import { supabase } from '../lib/supabase'

type School = { school_name: string | null; location: string | null; district: string | null; region: string | null; circuit: string | null }
type ClassCount = { id: string; name: string; count: number }
type Numbers = { students: number; classes: number; staff: number | null; cash: number | null; due: number | null; byClass: ClassCount[]; school: School | null }

function Stat({ icon: Icon, label, value, to, className = '' }: { icon: LucideIcon; label: string; value: ReactNode; to?: string; className?: string }) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md md:gap-4 md:p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand md:h-12 md:w-12"><Icon className="h-5 w-5 md:h-6 md:w-6" /></span>
      <div className="min-w-0">
        <p className="text-xl font-bold md:text-2xl tracking-tight text-slate-900">{value}</p>
        <p className="text-xs font-semibold leading-tight text-slate-500 md:text-sm">{label}</p>
      </div>
    </div>
  )
  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>
}

export default function Home() {
  const { state } = useAuth()
  const [n, setN] = useState<Numbers | null>(null)
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'

  useEffect(() => {
    if (state.status !== 'ready') return
    const today = new Date().toISOString().slice(0, 10)
    ;(async () => {
      const [stu, classes, term, school] = await Promise.all([
        fetchAll((from, to) => supabase!.from('students').select('class_id').eq('status', 'active').range(from, to)),
        supabase!.from('classes').select('id, name').order('level_order'),
        supabase!.from('terms').select('id').eq('is_current', true).maybeSingle(),
        supabase!.from('settings').select('school_name, location, district, region, circuit').maybeSingle(),
      ])
      const counts = new Map<string, number>()
      for (const s of stu) counts.set(s.class_id as string, (counts.get(s.class_id as string) ?? 0) + 1)
      const cls = (classes.data ?? []) as { id: string; name: string }[]
      let staff: number | null = null
      let cash: number | null = null
      let due: number | null = null
      if (isAdmin) {
        const [st, pay] = await Promise.all([
          supabase!.from('staff').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase!.from('payments').select('amount, status').eq('paid_on', today),
        ])
        staff = st.count ?? 0
        cash = cashTotal((pay.data ?? []) as { amount: number; status: string }[])
        if (term.data) {
          const bal = await supabase!.rpc('fee_balances', { p_term: (term.data as { id: string }).id })
          due = balanceTotals((bal.data ?? []) as BalanceRow[]).due
        }
      }
      setN({ students: stu.length, classes: cls.length, staff, cash, due, byClass: cls.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })), school: (school.data as School | null) ?? null })
    })()
  }, [state.status, isAdmin])

  if (state.status !== 'ready') return null

  const actions: { to: string; label: string; hint: string; icon: LucideIcon; admin?: boolean }[] = [
    { to: '/students/new', label: 'Add a student', hint: 'New admission', icon: UserPlus },
    { to: '/fees', label: 'Record a payment', hint: 'Cash received and receipt', icon: Receipt },
    { to: '/scores', label: 'Enter scores', hint: 'Marks out of 100', icon: ClipboardCheck },
    { to: '/report-cards', label: 'Report cards', hint: 'View, print, download', icon: FileText },
    { to: '/staff-attendance', label: 'Staff attendance', hint: 'Mark today', icon: UserCog, admin: true },
    { to: '/fees/balances', label: 'Fee balances', hint: 'Who owes what', icon: Wallet },
  ]
  const shown = actions.filter((a) => !a.admin || isAdmin)
  const max = Math.max(1, ...(n?.byClass.map((c) => c.count) ?? [1]))
  const place = [n?.school?.location, n?.school?.district && `${n.school.district}`, n?.school?.region && `${n.school.region} Region`, n?.school?.circuit && `${n.school.circuit} Circuit`].filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-brand to-indigo-700 px-6 py-7 text-white shadow-sm md:px-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><Landmark className="h-6 w-6 text-accent" /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{n?.school?.school_name || 'Alemiya Academy'}</h1>
            {place.length > 0 && <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-indigo-100"><MapPin className="h-4 w-4 shrink-0" /> {place.join(' · ')}</p>}
          </div>
        </div>
      </section>

      <section className={`grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-6`}>
        <Stat icon={Users} label="Students in school" value={n ? n.students : '–'} to="/students" className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} />
        <Stat icon={GraduationCap} label="Classes" value={n ? n.classes : '–'} to={isAdmin ? '/setup/classes' : '/students'} className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} />
        {isAdmin && <Stat icon={UserCog} label="Staff" value={n?.staff ?? '–'} to="/setup/staff" className="col-span-2 lg:col-span-2" />}
        {isAdmin && <Stat icon={Banknote} label="Cash received today" value={n?.cash == null ? '–' : formatMoney(n.cash)} to="/fees/cash" className="col-span-2 lg:col-span-3" />}
        {isAdmin && <Stat icon={Wallet} label="Fees still owed this term" value={n?.due == null ? '–' : formatMoney(n.due)} to="/fees/balances" className="col-span-2 lg:col-span-3" />}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <h2 className="border-b border-slate-100 px-5 py-4 text-base font-bold text-slate-900">Quick actions</h2>
          <ul className="divide-y divide-slate-100">
            {shown.map((a) => (
              <li key={a.to}>
                <Link to={a.to} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><a.icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block text-[15px] font-bold text-slate-900">{a.label}</span>
                    <span className="block text-sm font-medium text-slate-500">{a.hint}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">Students by class</h2>
            <Link to="/students" className="text-sm font-bold text-brand hover:underline">View all</Link>
          </div>
          {!n ? <p className="p-5 text-sm font-medium text-slate-500">Loading…</p> : n.byClass.length === 0 ? <p className="p-5 text-sm font-medium text-slate-500">No classes yet. Add them under Set up.</p> : (
            <ul className="flex flex-col gap-3.5 p-5">
              {n.byClass.map((c) => (
                <li key={c.id}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-bold text-slate-800">{c.name}</span>
                    <span className="font-bold tabular-nums text-slate-900">{c.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${(c.count / max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

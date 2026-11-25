import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, ChevronRight, FileSpreadsheet, ListChecks, Percent, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'
import type { Totals } from '../lib/attendance'
import { fetchAll } from '../lib/backup'
import { studentStats, type StatClass, type StatStudent, type StudentStats } from '../lib/student-stats'
import { supabase } from '../lib/supabase'

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:gap-4 md:p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand md:h-12 md:w-12"><Icon className="h-5 w-5 md:h-6 md:w-6" /></span>
      <div className="min-w-0">
        <p className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{value}</p>
        <p className="text-xs font-semibold leading-tight text-slate-500 md:text-sm">{label}</p>
        {hint && <p className="text-xs font-medium text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

const pct = (r: number | null) => (r === null ? '–' : `${r}%`)

export default function StudentsHub() {
  const { state } = useAuth()
  const { currentTerm } = useSchool()
  const [stats, setStats] = useState<StudentStats | null>(null)
  const [error, setError] = useState(false)
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'

  useEffect(() => {
    if (state.status !== 'ready') return
    ;(async () => {
      try {
        const [stu, cls, att] = await Promise.all([
          fetchAll((from, to) => supabase!.from('students').select('class_id, gender').eq('status', 'active').range(from, to)),
          supabase!.from('classes').select('id, name').order('level_order'),
          currentTerm ? supabase!.rpc('attendance_term_totals', { p_term: currentTerm.id }) : Promise.resolve({ data: [], error: null }),
        ])
        if (cls.error || att.error) throw new Error('load')
        const totals = ((att.data ?? []) as Totals[]).map((r) => ({ ...r, weeks: Number(r.weeks), school_days: Number(r.school_days), days_absent: Number(r.days_absent) }))
        setStats(studentStats(stu as StatStudent[], (cls.data ?? []) as StatClass[], totals))
      } catch {
        setError(true)
      }
    })()
  }, [state.status, currentTerm])

  const links: { to: string; label: string; hint: string; icon: LucideIcon; admin?: boolean }[] = [
    { to: '/students', label: 'Student list', hint: 'Search, view and edit records', icon: ListChecks },
    { to: '/attendance', label: 'Weekly attendance', hint: 'Record days absent', icon: CalendarCheck },
    { to: '/attendance/summary', label: 'Attendance summary', hint: 'Rates by class and student', icon: Percent },
    { to: '/students/import', label: 'Import from Excel', hint: 'Add many students at once', icon: FileSpreadsheet, admin: true },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm font-medium text-slate-500">Numbers, attendance and everything for students</p>
        </div>
        <Link to="/students/new" className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-ink sm:w-auto">
          <UserPlus className="h-5 w-5" /> Add a new student
        </Link>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Could not load the numbers. Check your connection and reload.</p>}

      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat icon={Users} label="Total students" value={stats ? stats.total : '–'} />
        <Stat icon={Users} label="Boys" value={stats ? stats.boys : '–'} />
        <Stat icon={Users} label="Girls" value={stats ? stats.girls : '–'} />
        <Stat icon={Percent} label="Attendance this term" value={stats ? pct(stats.attendance.rate) : '–'} hint={stats && stats.attendance.rate === null ? 'No weeks recorded yet' : undefined} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {links.filter((l) => !l.admin || isAdmin).map((l) => (
          <Link key={l.to} to={l.to} className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow-md">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><l.icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="block text-[15px] font-bold text-slate-900">{l.label}</span>
              <span className="block text-sm font-medium text-slate-500">{l.hint}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">By class</h2>
          <Link to="/attendance/summary" className="text-sm font-bold text-brand hover:underline">Attendance details</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3 font-bold">Class</th><th className="px-3 py-3 text-right font-bold">Students</th><th className="px-3 py-3 text-right font-bold">Boys</th><th className="px-3 py-3 text-right font-bold">Girls</th><th className="px-5 py-3 text-right font-bold">Attendance</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!stats && <tr><td colSpan={5} className="px-5 py-4 font-medium text-slate-500">Loading…</td></tr>}
              {stats?.classes.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-bold text-slate-900">{c.name}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{c.total}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{c.boys}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{c.girls}</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{pct(c.attendance.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

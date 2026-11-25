import { useEffect, useState } from 'react'
import { CalendarCheck, FileSpreadsheet, ListChecks, Percent, UserPlus, Users } from 'lucide-react'
import { ActionGrid, ErrorNote, PageHeader, Panel, Stat, StatGrid, type Action } from '../components/ui'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'
import type { Totals } from '../lib/attendance'
import { fetchAll } from '../lib/backup'
import { studentStats, type StatClass, type StatStudent, type StudentStats } from '../lib/student-stats'
import { supabase } from '../lib/supabase'

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

  const actions: (Action & { admin?: boolean })[] = [
    { to: '/students', label: 'Student list', hint: 'Search, view and edit records', icon: ListChecks },
    { to: '/attendance', label: 'Weekly attendance', hint: 'Record days absent', icon: CalendarCheck },
    { to: '/attendance/summary', label: 'Attendance summary', hint: 'Rates by class and student', icon: Percent },
    { to: '/students/import', label: 'Import from Excel', hint: 'Add many students at once', icon: FileSpreadsheet, admin: true },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Students" subtitle="Numbers, attendance and everything for students" action={{ to: '/students/new', label: 'Add a new student', icon: UserPlus }} />
      <ErrorNote show={error} />
      <StatGrid>
        <Stat icon={Users} label="Total students" value={stats ? stats.total : '–'} />
        <Stat icon={Users} label="Boys" value={stats ? stats.boys : '–'} />
        <Stat icon={Users} label="Girls" value={stats ? stats.girls : '–'} />
        <Stat icon={Percent} label="Attendance this term" value={stats ? pct(stats.attendance.rate) : '–'} hint={stats && stats.attendance.rate === null ? 'No weeks recorded yet' : undefined} />
      </StatGrid>
      <ActionGrid actions={actions.filter((l) => !l.admin || isAdmin)} />
      <Panel title="By class" link={{ to: '/attendance/summary', label: 'Attendance details' }}>
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
      </Panel>
    </div>
  )
}

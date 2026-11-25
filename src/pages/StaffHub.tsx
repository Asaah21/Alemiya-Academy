import { useEffect, useState } from 'react'
import { CalendarCheck, Clock, Percent, UserCheck, UserCog, UserMinus, UserPlus, Users } from 'lucide-react'
import { ActionGrid, ErrorNote, PageHeader, Stat, StatGrid, type Action } from '../components/ui'
import { supabase } from '../lib/supabase'

type Today = { total: number; present: number; late: number; absent: number; permission: number; notMarked: number }

const ACTIONS: Action[] = [
  { to: '/setup/staff', label: 'Staff list', hint: 'View and edit staff records', icon: UserCog },
  { to: '/staff-attendance', label: 'Mark attendance', hint: 'Present, absent, late, permission', icon: CalendarCheck },
  { to: '/staff-attendance/summary', label: 'Attendance summary', hint: 'Rates for the term', icon: Percent },
]

export default function StaffHub() {
  const [t, setT] = useState<Today | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase!.from('staff').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase!.from('staff_attendance').select('status').eq('attendance_date', today),
    ]).then(([s, a]) => {
      if (s.error || a.error) return setError(true)
      const rows = (a.data ?? []) as { status: string }[]
      const n = (k: string) => rows.filter((r) => r.status === k).length
      const total = s.count ?? 0
      setT({ total, present: n('present'), late: n('late'), absent: n('absent'), permission: n('on_leave'), notMarked: Math.max(0, total - rows.length) })
    })
  }, [])

  const v = (k: keyof Today) => (t ? t[k] : '–')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" subtitle="Staff records and today's attendance" action={{ to: '/setup/staff', label: 'Add a new staff member', icon: UserPlus }} />
      <ErrorNote show={error} />
      <StatGrid cols={3}>
        <Stat icon={Users} label="Staff in school" value={v('total')} />
        <Stat icon={UserCheck} label="Present today" value={v('present')} />
        <Stat icon={Clock} label="Late today" value={v('late')} />
        <Stat icon={UserMinus} label="Absent today" value={v('absent')} />
        <Stat icon={CalendarCheck} label="Absent by permission" value={v('permission')} />
        <Stat icon={Percent} label="Not marked yet today" value={v('notMarked')} hint={t && t.notMarked > 0 ? 'Mark attendance to complete today' : undefined} />
      </StatGrid>
      <ActionGrid actions={ACTIONS} />
    </div>
  )
}

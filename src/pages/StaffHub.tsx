import { useEffect, useState } from 'react'
import { CalendarCheck, Percent, UserCheck, UserCog, UserMinus, UserPlus, Users } from 'lucide-react'
import { ActionGrid, ErrorNote, PageHeader, type Action } from '../components/ui'
import { supabase } from '../lib/supabase'

type Person = { id: string; full_name: string }
type Which = 'total' | 'present' | 'absent'

const ACTIONS: Action[] = [
  { to: '/setup/staff', label: 'Staff list', hint: 'View and edit staff records', icon: UserCog },
  { to: '/staff-attendance', label: 'Mark attendance', hint: 'Present, absent, late, permission', icon: CalendarCheck },
  { to: '/staff-attendance/summary', label: 'Attendance summary', hint: 'Rates for the term', icon: Percent },
]

export default function StaffHub() {
  const [staff, setStaff] = useState<Person[] | null>(null)
  const [marks, setMarks] = useState<{ staff_id: string; status: string }[]>([])
  const [error, setError] = useState(false)
  const [open, setOpen] = useState<Which | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase!.from('staff').select('id, full_name').eq('status', 'active').order('full_name'),
      supabase!.from('staff_attendance').select('staff_id, status').eq('attendance_date', today),
    ]).then(([s, a]) => {
      if (s.error || a.error) return setError(true)
      setStaff((s.data as Person[]) ?? [])
      setMarks((a.data as { staff_id: string; status: string }[]) ?? [])
    })
  }, [])

  const ids = (statuses: string[]) => new Set(marks.filter((m) => statuses.includes(m.status)).map((m) => m.staff_id))
  const present = ids(['present', 'late'])
  const absent = ids(['absent', 'on_leave'])
  const marked = marks.length > 0
  const lists: Record<Which, Person[]> = {
    total: staff ?? [],
    present: (staff ?? []).filter((p) => present.has(p.id)),
    absent: (staff ?? []).filter((p) => absent.has(p.id)),
  }
  const cards: { k: Which; label: string; icon: typeof Users; show: boolean }[] = [
    { k: 'total', label: 'Total staff', icon: Users, show: true },
    { k: 'present', label: 'Present today', icon: UserCheck, show: marked },
    { k: 'absent', label: 'Absent today', icon: UserMinus, show: marked },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" subtitle="Tap a number to see who is included" action={{ to: '/setup/staff', label: 'Add a new staff member', icon: UserPlus }} />
      <ErrorNote show={error} />
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.filter((c) => c.show).map((c) => (
          <button key={c.k} onClick={() => setOpen(open === c.k ? null : c.k)} className={`flex items-center gap-4 rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-brand/40 ${open === c.k ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'}`}>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand"><c.icon className="h-6 w-6" /></span>
            <span><span className="block text-3xl font-extrabold text-slate-900">{staff ? lists[c.k].length : '–'}</span><span className="block text-sm font-bold text-slate-500">{c.label}</span></span>
          </button>
        ))}
      </div>
      {!marked && staff && <p className="text-sm font-medium text-slate-500">Attendance has not been marked today.</p>}
      {open && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-slate-900">{cards.find((c) => c.k === open)?.label}</h2>
          {lists[open].length === 0 ? <p className="text-sm text-slate-500">No one to show.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{lists[open].map((p) => <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-800">{p.full_name}</li>)}</ul>
          )}
        </div>
      )}
      <ActionGrid actions={ACTIONS} />
    </div>
  )
}

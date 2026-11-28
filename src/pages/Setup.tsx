import { Link } from 'react-router-dom'
import { Archive, BadgeCheck, BookOpen, CalendarDays, ChevronRight, GraduationCap, KeyRound, Lock, Medal, School, Wallet, type LucideIcon } from 'lucide-react'

const LINKS: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: '/setup/years', label: 'Current term, years and terms', hint: 'Choose the current term and edit dates', icon: CalendarDays },
  { to: '/setup/school', label: 'School info', hint: 'Name, location, circuit, score maximum', icon: School },
  { to: '/setup/classes', label: 'Classes', hint: 'Nursery 1 to JHS 3', icon: GraduationCap },
  { to: '/setup/subjects', label: 'Subjects', hint: 'Subjects taught in each class', icon: BookOpen },
  { to: '/setup/grades', label: 'Grades', hint: 'Grade bands and remarks', icon: Medal },
  { to: '/setup/fees', label: 'Fees', hint: 'What each class pays each term', icon: Wallet },
  { to: '/setup/users', label: 'Users', hint: 'Staff logins and roles', icon: KeyRound },
  { to: '/setup/parents', label: 'Parent access slips', hint: 'Login codes for parents', icon: BadgeCheck },
  { to: '/setup/close', label: 'Close a term', hint: 'Lock records and save a snapshot', icon: Lock },
  { to: '/setup/promotion', label: 'Year-end promotion', hint: 'Move classes up, graduate JHS 3', icon: GraduationCap },
  { to: '/setup/backup', label: 'Backup and export', hint: 'Download all records', icon: Archive },
]

export default function Setup() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Set up</h1>
        <p className="text-sm font-medium text-slate-500">Term, school details and administration tools</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow-md">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><l.icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="block text-[15px] font-bold text-slate-900">{l.label}</span>
              <span className="block text-sm font-medium text-slate-500">{l.hint}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </div>
  )
}

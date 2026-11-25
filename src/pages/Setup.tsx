import { Link } from 'react-router-dom'

const LINKS: { to: string; label: string }[] = [
  { to: '/setup/years', label: 'Set the current term, years and terms' },
  { to: '/setup/school', label: 'School info' },
  { to: '/setup/classes', label: 'Classes' },
  { to: '/setup/subjects', label: 'Subjects' },
  { to: '/setup/grades', label: 'Grades' },
  { to: '/setup/fees', label: 'Fees: what each class pays' },
  { to: '/setup/users', label: 'Users: staff logins' },
  { to: '/setup/parents', label: 'Parent access slips' },
  { to: '/setup/close', label: 'Close a term' },
  { to: '/setup/promotion', label: 'Year-end promotion' },
  { to: '/setup/backup', label: 'Backup and export' },
]

export default function Setup() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold text-brand">Set up</h1>
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="rounded-xl border-l-4 border-brand bg-white p-5 text-lg font-bold shadow-sm active:bg-slate-100">{l.label}</Link>
      ))}
    </div>
  )
}

import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { findSection, linksFor } from '../features/nav/menu'

// One section's page: a card for each thing you can do there.
export default function Hub() {
  const { id } = useParams()
  const { state } = useAuth()
  if (state.status !== 'ready') return null
  const section = findSection(id ?? '')
  if (!section || !section.roles.includes(state.profile.role)) return <Navigate to="/" replace />
  const links = linksFor(section, state.profile.role)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand"><section.icon className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{section.label}</h1>
          <p className="text-sm font-medium text-slate-500">{section.hint}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((l) => (
          <Link key={l.path} to={l.path} className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow-md">
            <span className="text-[15px] font-bold text-slate-900">{l.label}</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </div>
  )
}

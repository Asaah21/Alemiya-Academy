import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { findSection, linksFor } from '../features/nav/menu'

// One section's page: a big button for each thing you can do there.
export default function Hub() {
  const { id } = useParams()
  const { state } = useAuth()
  if (state.status !== 'ready') return null
  const section = findSection(id ?? '')
  if (!section || !section.roles.includes(state.profile.role)) return <Navigate to="/" replace />
  const links = linksFor(section, state.profile.role)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-brand">{section.label}</h1>
      <div className="flex flex-col gap-3">
        {links.map((l) => (
          <Link key={l.path} to={l.path} className="rounded-xl border-l-4 border-brand bg-white p-5 text-lg font-bold shadow-sm active:bg-slate-100">{l.label}</Link>
        ))}
      </div>
    </div>
  )
}

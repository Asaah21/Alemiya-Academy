import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'

// Shown on every screen: the school and the current term (acceptance check for T05).
export default function TermBadge() {
  const { schoolName, currentTerm, loaded } = useSchool()
  const { state } = useAuth()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  if (!loaded) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm shadow-sm print:hidden">
      {schoolName && <span className="font-semibold">{schoolName}</span>}
      {currentTerm ? (
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
          {currentTerm.name}, {currentTerm.year_name}
        </span>
      ) : isAdmin ? (
        <Link to="/setup/years" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 underline">
          No current term: set one up
        </Link>
      ) : (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">No current term set</span>
      )}
    </div>
  )
}

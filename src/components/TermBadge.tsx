import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'

// The school and term are shown in the top bar. This only appears when no term is set, because many screens need one.
export default function TermBadge() {
  const { currentTerm, loaded } = useSchool()
  const { state } = useAuth()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  if (!loaded || currentTerm) return null
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 print:hidden">
      <TriangleAlert className="h-5 w-5 shrink-0" />
      {isAdmin ? <span>No current term is set. <Link to="/setup/years" className="underline">Set one up</Link> so attendance, scores and fees can be recorded.</span> : <span>No current term is set. Ask the Admin to set one.</span>}
    </div>
  )
}

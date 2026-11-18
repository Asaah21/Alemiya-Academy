import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

// T04 will replace this with the real menu. For now: a welcome and the one screen that exists.
export default function Home() {
  const { state } = useAuth()
  if (state.status !== 'ready') return null
  const { profile } = state

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Welcome, {profile.full_name}</h1>
      {profile.role === 'admin' ? (
        <Link to="/setup/users" className="rounded-xl bg-white p-4 font-medium shadow-sm">
          Users: add staff, reset passwords
        </Link>
      ) : (
        <p className="text-slate-600">More screens arrive in the next build steps.</p>
      )}
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { menuFor } from '../features/nav/menu'

export default function Home() {
  const { state } = useAuth()
  if (state.status !== 'ready') return null
  const { profile } = state
  const items = menuFor(profile.role).filter((m) => m.path !== '/')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Welcome, {profile.full_name}</h1>
      <div className="grid grid-cols-2 gap-3">
        {items.map((m) => (
          <Link key={m.path} to={m.path} className="rounded-xl bg-white p-5 text-center font-medium shadow-sm">
            {m.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

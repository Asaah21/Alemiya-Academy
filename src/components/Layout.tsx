import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

// Simple frame for every logged-in screen. T04 will add the full menu here.
export default function Layout({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth()
  if (state.status !== 'ready') return null
  const { profile } = state

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between gap-3 bg-white p-4 shadow-sm">
        <Link to="/" className="text-lg font-bold text-brand">
          Alemiya Academy
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/account" className="text-slate-700 underline">
            {profile.full_name}
          </Link>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium capitalize">{profile.role}</span>
          <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-2 font-medium">
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  )
}

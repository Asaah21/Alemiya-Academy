import { useState, type FormEvent } from 'react'
import { GraduationCap } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

export default function Login() {
  const { state, signIn, signOut } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state.status === 'ready') return <Navigate to="/" replace />
  if (state.status === 'parent') return <Navigate to="/parent/home" replace />

  const noProfile = state.status === 'no-profile' || Boolean((location.state as { noProfile?: boolean } | null)?.noProfile)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await signIn(email, password))
    setBusy(false)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-ink via-brand to-teal-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/5" />
      <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-white/5" />
      <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><GraduationCap className="h-6 w-6 text-accent" /></span>
      <div className="relative">
        <h2 className="text-4xl font-bold tracking-tight">Alemiya Academy</h2>
        <p className="mt-3 max-w-sm text-lg font-medium text-teal-100">Students, scores, fees and reports in one simple place.</p>
      </div>
      <p className="relative text-sm font-medium text-teal-100/70">School Management System</p>
    </aside>
    <main className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 font-medium text-slate-500">Sign in to Alemiya Academy</p>
      </div>

      {noProfile && (
        <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
          Your login is correct, but your account has not been switched on yet. Please ask the Admin to activate it.
          {state.status === 'no-profile' && (
            <button onClick={signOut} className="mt-2 block font-medium underline">
              Log out
            </button>
          )}
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 p-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-300 p-3 text-base"
          />
        </label>
        {error && <p className="rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand p-3.5 text-base font-bold text-white shadow-sm hover:bg-ink disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-xs text-slate-500">Are you a parent? <Link to="/parent" className="underline">Parent login</Link></p>
      <p className="text-xs text-slate-500">Forgot your password? Ask the Admin to give you a new one.</p>
    </main>
    </div>
  )
}

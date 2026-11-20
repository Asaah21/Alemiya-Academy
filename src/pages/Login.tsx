import { useState, type FormEvent } from 'react'
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">Alemiya Academy</h1>
        <p className="mt-1 text-slate-600">Staff login</p>
      </div>

      {noProfile && (
        <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
          Your login works, but your account is not active. Please ask the Admin to set it up.
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
          className="rounded-lg bg-brand p-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-xs text-slate-500">Are you a parent? <Link to="/parent" className="underline">Parent login</Link></p>
      <p className="text-xs text-slate-500">Forgot your password? Ask the Admin to give you a new one.</p>
    </main>
  )
}

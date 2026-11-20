import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'

// Parents log in with the child's admission number and the access code from the slip (no email, no password to remember).
export default function ParentLogin() {
  const { state, signInParent, signOut } = useAuth()
  const { schoolName } = useSchool()
  const [admissionNo, setAdmissionNo] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state.status === 'parent') return <Navigate to="/parent/home" replace />
  if (state.status === 'ready') return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await signInParent(admissionNo, code))
    setBusy(false)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">{schoolName || 'Alemiya Academy'}</h1>
        <p className="mt-1 text-slate-600">Parent login</p>
      </div>
      {state.status === 'no-profile' && (
        <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
          This login is not active for parents. Please ask the school for a new slip.
          <button onClick={signOut} className="mt-2 block font-medium underline">Log out</button>
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Child's admission number
          <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="ALM-2026-001" autoCapitalize="characters" autoComplete="username" required className="rounded-lg border border-slate-300 p-3 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Access code (on your slip)
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-2345" autoCapitalize="characters" autoComplete="current-password" required className="rounded-lg border border-slate-300 p-3 font-mono text-base tracking-widest" />
        </label>
        {error && <p className="rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-brand p-3 text-base font-semibold text-white disabled:opacity-60">{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="text-xs text-slate-500">Lost your slip? Ask the school office for a new one.</p>
      <p className="text-xs text-slate-500">Staff? <Link to="/login" className="underline">Staff login</Link></p>
    </main>
  )
}

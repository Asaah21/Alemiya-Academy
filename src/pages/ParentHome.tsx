import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

export default function ParentHome() {
  const { state, signOut } = useAuth()
  if (state.status === 'loading') return <p className="p-6 text-slate-600">Loading…</p>
  if (state.status !== 'parent') return <Navigate to="/parent" replace />
  const c = state.child
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand">{c.schoolName || 'Alemiya Academy'}</h1>
        <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Log out</button>
      </header>
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Welcome. This is the page for</p>
        <p className="text-2xl font-bold">{c.fullName}</p>
        <p className="text-slate-600">{c.className} · {c.admissionNo}</p>
      </section>
      <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">Report cards and fee balances will appear here soon.</p>
    </main>
  )
}

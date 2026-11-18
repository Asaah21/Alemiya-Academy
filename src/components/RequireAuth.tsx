import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import type { UserRole } from '../lib/users'
import Layout from './Layout'

// Wrap a screen with <RequireAuth> (any logged-in user) or <RequireAuth role="admin"> (Admin only).
export default function RequireAuth({ children, role }: { children: ReactNode; role?: UserRole }) {
  const { state } = useAuth()

  if (state.status === 'loading') {
    return <p className="p-6 text-slate-600">Loading…</p>
  }
  if (state.status === 'signed-out') return <Navigate to="/login" replace />
  if (state.status === 'no-profile') return <Navigate to="/login" replace state={{ noProfile: true }} />

  if (role && state.profile.role !== role) {
    return (
      <Layout>
        <p className="rounded-xl bg-amber-100 p-4 text-amber-900">
          You do not have permission to open this page.
        </p>
      </Layout>
    )
  }
  return <Layout>{children}</Layout>
}

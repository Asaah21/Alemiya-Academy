import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { normaliseCode, parentEmail } from '../../lib/parent-access'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../lib/users'

export type Profile = {
  id: string
  full_name: string
  role: UserRole
  active: boolean
}

export type ParentChild = { studentId: string; fullName: string; admissionNo: string; className: string; schoolName: string }

// 'parent' = a parent logged in with a child's admission number and access code (see parent_me in the database).
// 'no-profile' = logged in, but the Admin has not set this person up (or has deactivated them).
type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'no-profile'; session: Session }
  | { status: 'ready'; session: Session; profile: Profile }
  | { status: 'parent'; session: Session; child: ParentChild }

type AuthContextValue = {
  state: AuthState
  signIn: (email: string, password: string) => Promise<string | null>
  signInParent: (admissionNo: string, code: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const load = useCallback(async (session: Session | null) => {
    if (!supabase || !session) {
      setState({ status: 'signed-out' })
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, active')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
    if (data && data.active) return setState({ status: 'ready', session, profile: data as Profile })
    const { data: kid } = await supabase.rpc('parent_me')
    const c = Array.isArray(kid) ? kid[0] : null
    if (c) {
      setState({ status: 'parent', session, child: { studentId: c.student_id, fullName: c.full_name, admissionNo: c.admission_no, className: c.class_name, schoolName: c.school_name } })
    } else setState({ status: 'no-profile', session })
  }, [])

  useEffect(() => {
    if (!supabase) {
      setState({ status: 'signed-out' })
      return
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer so we never run database calls inside the auth callback itself.
      setTimeout(() => load(session), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: async (email, password) => {
        if (!supabase) return 'The system is not set up yet.'
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        return error ? 'Wrong email or password. Please try again.' : null
      },
      signInParent: async (admissionNo, code) => {
        if (!supabase) return 'The system is not set up yet.'
        if (!admissionNo.trim() || !code.trim()) return 'Enter the admission number and the access code from your slip.'
        const { error } = await supabase.auth.signInWithPassword({ email: parentEmail(admissionNo), password: normaliseCode(code) })
        return error ? 'The admission number or access code is wrong. Check your slip and try again.' : null
      },
      signOut: async () => {
        await supabase?.auth.signOut()
        setState({ status: 'signed-out' })
      },
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

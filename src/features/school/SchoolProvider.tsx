import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'

export type CurrentTerm = { id: string; name: string; start_date: string; end_date: string; year_id: string; year_name: string }

type SchoolContextValue = {
  schoolName: string
  currentTerm: CurrentTerm | null
  loaded: boolean
  reload: () => Promise<void>
}

const SchoolContext = createContext<SchoolContextValue>({
  schoolName: '',
  currentTerm: null,
  loaded: false,
  reload: async () => {},
})

// Loads the school name and the current term once after login, so every screen can show them.
export function SchoolProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const ready = state.status === 'ready'
  const [schoolName, setSchoolName] = useState('')
  const [currentTerm, setCurrentTerm] = useState<CurrentTerm | null>(null)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [s, t] = await Promise.all([
      supabase.from('settings').select('school_name').maybeSingle(),
      supabase
        .from('terms')
        .select('id, name, start_date, end_date, academic_year_id, academic_years(name)')
        .eq('is_current', true)
        .maybeSingle(),
    ])
    setSchoolName(s.data?.school_name ?? '')
    const row = t.data as { id: string; name: string; start_date: string; end_date: string; academic_year_id: string; academic_years: { name: string } | { name: string }[] | null } | null
    if (row) {
      const y = Array.isArray(row.academic_years) ? row.academic_years[0] : row.academic_years
      setCurrentTerm({ id: row.id, name: row.name, start_date: row.start_date, end_date: row.end_date, year_id: row.academic_year_id, year_name: y?.name ?? '' })
    } else {
      setCurrentTerm(null)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (ready) reload()
    else {
      setSchoolName('')
      setCurrentTerm(null)
      setLoaded(false)
    }
  }, [ready, reload])

  const value = useMemo(() => ({ schoolName, currentTerm, loaded, reload }), [schoolName, currentTerm, loaded, reload])
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

export function useSchool(): SchoolContextValue {
  return useContext(SchoolContext)
}

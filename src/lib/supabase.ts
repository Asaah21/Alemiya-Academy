import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// Null until both environment variables are set (see .env.example).
export const supabase = isConfigured ? createClient(url!, anonKey!) : null

export type ConnectionStatus = 'not-configured' | 'connected' | 'unreachable'

// Calls Supabase's public auth settings endpoint, which needs a valid project
// address and public key but no database tables. Used only by the Home page
// to show that the app can reach the database.
export async function checkConnection(): Promise<ConnectionStatus> {
  if (!isConfigured) return 'not-configured'
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey! },
    })
    return res.ok ? 'connected' : 'unreachable'
  } catch {
    return 'unreachable'
  }
}

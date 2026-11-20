import { createClient } from '@supabase/supabase-js'
import { handleParentAccess } from '../../src/lib/parent-access'

// Admin-only: makes parent access codes and slips. Uses the same two Netlify settings as manage-users
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY). The key must never reach the browser or GitHub.
export default async (req: Request): Promise<Response> => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'The server is not set up yet: add SUPABASE_SERVICE_ROLE_KEY in Netlify.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return handleParentAccess(req, admin)
}

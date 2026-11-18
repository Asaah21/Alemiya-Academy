import { createClient } from '@supabase/supabase-js'
import { handleManageUsers } from '../../src/lib/manage-users'

// Admin-only user management. Needs two settings in Netlify (Site configuration > Environment variables):
//   SUPABASE_URL                 the project address (same as VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY    the SECRET key from Supabase. Mark it "contains secret values".
//                                It must never be given to the browser or committed to GitHub.
export default async (req: Request): Promise<Response> => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'The server is not set up yet: add SUPABASE_SERVICE_ROLE_KEY in Netlify.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return handleManageUsers(req, admin)
}

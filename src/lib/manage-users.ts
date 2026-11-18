// Server-side logic for the Admin's user management (used by netlify/functions/manage-users.mts).
// It runs with the Supabase service key, so the FIRST thing it does is check that the caller
// is a logged-in, active Admin. Everything after that trusts that check.
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateNewUser, validatePassword } from './users'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function handleManageUsers(req: Request, admin: SupabaseClient): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  // 1. Who is calling?
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'Please log in again.' })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth?.user) return json(401, { error: 'Please log in again.' })

  const { data: me } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle()
  if (!me || !me.active || me.role !== 'admin') {
    return json(403, { error: 'Only the Admin can manage users.' })
  }

  // 2. What do they want?
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Bad request.' })
  }

  if (body.action === 'create') {
    const v = validateNewUser(body)
    if (!v.ok) return json(400, { error: v.error })
    const u = v.value
    const created = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    })
    if (created.error || !created.data?.user) {
      const already = /already|registered|exists/i.test(created.error?.message ?? '')
      return json(already ? 409 : 500, {
        error: already ? 'A user with this email already exists.' : 'Could not create the user.',
      })
    }
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .insert({
        auth_user_id: created.data.user.id,
        full_name: u.full_name,
        role: u.role,
        phone: u.phone,
        email: u.email,
      })
      .select('id, full_name, email, role, phone, active')
      .single()
    if (profileError || !profile) {
      // do not leave a login without a profile behind
      await admin.auth.admin.deleteUser(created.data.user.id)
      return json(500, { error: 'Could not create the user.' })
    }
    return json(200, { user: profile })
  }

  if (body.action === 'set_active') {
    if (typeof body.profile_id !== 'string' || typeof body.active !== 'boolean') {
      return json(400, { error: 'Bad request.' })
    }
    if (body.profile_id === me.id && body.active === false) {
      return json(400, { error: 'You cannot deactivate your own account.' })
    }
    const { error } = await admin.from('profiles').update({ active: body.active }).eq('id', body.profile_id)
    if (error) return json(500, { error: 'Could not update the user.' })
    return json(200, { ok: true })
  }

  if (body.action === 'reset_password') {
    if (typeof body.profile_id !== 'string') return json(400, { error: 'Bad request.' })
    const pw = validatePassword(body.password)
    if (!pw.ok) return json(400, { error: pw.error })
    const { data: target } = await admin
      .from('profiles')
      .select('auth_user_id')
      .eq('id', body.profile_id)
      .maybeSingle()
    if (!target) return json(404, { error: 'User not found.' })
    const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password: pw.value })
    if (error) return json(500, { error: 'Could not reset the password.' })
    return json(200, { ok: true })
  }

  return json(400, { error: 'Unknown action.' })
}

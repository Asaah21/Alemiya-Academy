// Parent access codes (rule C5, decision D8). A parent logs in with the child's admission number and a private code
// printed on a slip. The code itself is shown once, on the slip; only a hash is kept in the database.
import type { SupabaseClient } from '@supabase/supabase-js'

// No 0/O, 1/I/L: they are easy to misread on a printed slip.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 8
export const MAX_SLIPS_AT_ONCE = 100

export function generateCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = ''
  const limit = 256 - (256 % CODE_ALPHABET.length) // avoid a biased pick
  while (out.length < CODE_LENGTH) {
    for (const b of random(16)) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
    }
  }
  return out
}

// What parents type is forgiven: any case, spaces or a dash in the middle.
export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export const formatCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`

// The parent's login name. Never shown to parents; the login screen builds it from the admission number.
export function parentEmail(admissionNo: string): string {
  const local = admissionNo.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${local || 'student'}@parents.alemiya.school`
}

export async function hashCode(studentId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${studentId}:${normaliseCode(code)}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type IssuedSlip = { student_id: string; full_name: string; admission_no: string; class_name: string; code: string }
export type IssueFailure = { student_id: string; full_name: string; reason: string }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// Server side (netlify/functions/parent-access.mts). Runs with the service key, so it first checks the caller is an active Admin.
export async function handleParentAccess(req: Request, admin: SupabaseClient): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'Please log in again.' })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth?.user) return json(401, { error: 'Please log in again.' })
  const { data: me } = await admin.from('profiles').select('id, role, active').eq('auth_user_id', auth.user.id).maybeSingle()
  if (!me || !me.active || me.role !== 'admin') return json(403, { error: 'Only the Admin can make parent access slips.' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Bad request.' })
  }

  if (body.action === 'issue') {
    const ids = Array.isArray(body.student_ids) ? [...new Set(body.student_ids.filter((x): x is string => typeof x === 'string'))] : []
    if (ids.length === 0) return json(400, { error: 'Choose at least one student.' })
    if (ids.length > MAX_SLIPS_AT_ONCE) return json(400, { error: `Make at most ${MAX_SLIPS_AT_ONCE} slips at a time.` })

    const { data: students, error } = await admin
      .from('students')
      .select('id, full_name, admission_no, status, classes(name)')
      .in('id', ids)
    if (error) return json(500, { error: 'Could not read the students.' })

    const slips: IssuedSlip[] = []
    const failed: IssueFailure[] = []
    for (const s of (students ?? []) as unknown as { id: string; full_name: string; admission_no: string; status: string; classes: { name: string } | { name: string }[] | null }[]) {
      if (s.status !== 'active') { failed.push({ student_id: s.id, full_name: s.full_name, reason: 'Not an active student.' }); continue }
      const code = generateCode()
      const { data: existing } = await admin.from('parent_access').select('id, auth_user_id').eq('student_id', s.id).maybeSingle()
      let userId: string | null = existing?.auth_user_id ?? null
      if (userId) {
        const { error: e } = await admin.auth.admin.updateUserById(userId, { password: normaliseCode(code) })
        if (e) { failed.push({ student_id: s.id, full_name: s.full_name, reason: 'Could not set the code.' }); continue }
      } else {
        const created = await admin.auth.admin.createUser({ email: parentEmail(s.admission_no), password: normaliseCode(code), email_confirm: true })
        if (created.error || !created.data?.user) { failed.push({ student_id: s.id, full_name: s.full_name, reason: 'Could not create the parent login.' }); continue }
        userId = created.data.user.id
      }
      const row = { student_id: s.id, code_hash: await hashCode(s.id, code), auth_user_id: userId, active: true }
      const { error: e2 } = existing
        ? await admin.from('parent_access').update(row).eq('id', existing.id)
        : await admin.from('parent_access').insert(row)
      if (e2) { failed.push({ student_id: s.id, full_name: s.full_name, reason: 'Could not save.' }); continue }
      const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes
      slips.push({ student_id: s.id, full_name: s.full_name, admission_no: s.admission_no, class_name: cls?.name ?? '', code })
    }
    return json(200, { slips, failed })
  }

  if (body.action === 'set_active') {
    if (typeof body.student_id !== 'string' || typeof body.active !== 'boolean') return json(400, { error: 'Bad request.' })
    const { data: row } = await admin.from('parent_access').select('id, auth_user_id').eq('student_id', body.student_id).maybeSingle()
    if (!row) return json(404, { error: 'This student has no parent access yet.' })
    const { error } = await admin.from('parent_access').update({ active: body.active }).eq('id', row.id)
    if (error) return json(500, { error: 'Could not update.' })
    if (row.auth_user_id) {
      // a stopped parent cannot log in at all; switching back on works with the same code
      await admin.auth.admin.updateUserById(row.auth_user_id, { ban_duration: body.active ? 'none' : '87600h' })
    }
    return json(200, { ok: true })
  }

  return json(400, { error: 'Unknown action.' })
}

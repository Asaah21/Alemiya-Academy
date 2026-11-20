import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { CODE_ALPHABET, formatCode, generateCode, handleParentAccess, hashCode, normaliseCode, parentEmail } from './parent-access'

describe('codes', () => {
  it('makes 8 characters from the readable alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCode()
      expect(c).toHaveLength(8)
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch)
    }
  })
  it('does not repeat', () => {
    expect(new Set(Array.from({ length: 500 }, () => generateCode())).size).toBe(500)
  })
  it('never uses easy-to-confuse characters', () => expect(CODE_ALPHABET).not.toMatch(/[01OIL]/))
  it('forgives case, spaces and a dash', () => expect(normaliseCode(' abcd-2345 ')).toBe('ABCD2345'))
  it('shows the code in two halves', () => expect(formatCode('ABCD2345')).toBe('ABCD-2345'))
  it('builds the hidden login email from the admission number', () => {
    expect(parentEmail('ALM-2026-001')).toBe('alm-2026-001@parents.alemiya.school')
    expect(parentEmail(' Old/12 ')).toBe('old-12@parents.alemiya.school')
  })
  it('hashes per student, ignoring how the code is typed', async () => {
    const a = await hashCode('s1', 'abcd-2345')
    expect(a).toBe(await hashCode('s1', 'ABCD2345'))
    expect(a).not.toBe(await hashCode('s2', 'ABCD2345'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})

type Row = Record<string, unknown>
function fake(tokens: Record<string, string>, profiles: Row[], students: Row[], access: Row[]) {
  const passwords = new Map<string, string>()
  const bans: Record<string, string> = {}
  let n = 0
  const client = {
    auth: {
      getUser: async (t: string) => (tokens[t] ? { data: { user: { id: tokens[t] } }, error: null } : { data: { user: null }, error: { message: 'bad' } }),
      admin: {
        createUser: async ({ email, password }: { email: string; password: string }) => {
          if (email.startsWith('dup')) return { data: { user: null }, error: { message: 'exists' } }
          const id = `parent-${++n}`
          passwords.set(id, password)
          return { data: { user: { id } }, error: null }
        },
        updateUserById: async (id: string, p: { password?: string; ban_duration?: string }) => {
          if (p.password) passwords.set(id, p.password)
          if (p.ban_duration) bans[id] = p.ban_duration
          return { error: null }
        },
      },
    },
    from: (table: string) => {
      let filter: [string, unknown] | null = null
      let ids: unknown[] | null = null
      let patch: Row | null = null
      const rows = table === 'profiles' ? profiles : table === 'students' ? students : access
      const b: Record<string, unknown> = {
        select: () => b,
        in: (_c: string, v: unknown[]) => { ids = v; return Promise.resolve({ data: rows.filter((r) => ids!.includes(r.id)), error: null }) },
        eq: (c: string, v: unknown) => {
          filter = [c, v]
          if (patch) { for (const r of rows) if (r[c] === v) Object.assign(r, patch); return Promise.resolve({ error: null }) }
          return b
        },
        update: (p: Row) => { patch = p; return b },
        insert: (r: Row) => { rows.push({ id: `a-${rows.length + 1}`, ...r }); return Promise.resolve({ error: null }) },
        maybeSingle: async () => ({ data: rows.find((r) => filter && r[filter[0]] === filter[1]) ?? null, error: null }),
      }
      return b
    },
  }
  return { client: client as unknown as SupabaseClient, passwords, bans }
}

const req = (body: unknown, token?: string, method = 'POST') =>
  new Request('https://x.test/f', { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined })

let profiles: Row[], students: Row[], access: Row[], env: ReturnType<typeof fake>
beforeEach(() => {
  profiles = [{ id: 'p1', auth_user_id: 'u-admin', role: 'admin', active: true }, { id: 'p2', auth_user_id: 'u-staff', role: 'staff', active: true }]
  students = [
    { id: 's1', full_name: 'Ama', admission_no: 'ALM-2026-001', status: 'active', classes: { name: 'Basic 3' } },
    { id: 's2', full_name: 'Kofi', admission_no: 'dup-2', status: 'active', classes: [{ name: 'Basic 4' }] },
    { id: 's3', full_name: 'Esi', admission_no: 'ALM-2026-003', status: 'withdrawn', classes: null },
  ]
  access = []
  env = fake({ a: 'u-admin', s: 'u-staff' }, profiles, students, access)
})

describe('who may call', () => {
  it('needs a login, an Admin, and POST', async () => {
    expect((await handleParentAccess(req({}), env.client)).status).toBe(401)
    expect((await handleParentAccess(req({}, 'bad'), env.client)).status).toBe(401)
    expect((await handleParentAccess(req({ action: 'issue', student_ids: ['s1'] }, 's'), env.client)).status).toBe(403)
    expect((await handleParentAccess(req(null, 'a', 'GET'), env.client)).status).toBe(405)
  })
})

describe('issue', () => {
  it('makes a code, a parent login and a hashed record', async () => {
    const res = await handleParentAccess(req({ action: 'issue', student_ids: ['s1'] }, 'a'), env.client)
    const { slips, failed } = await res.json()
    expect(failed).toEqual([])
    expect(slips).toHaveLength(1)
    expect(slips[0]).toMatchObject({ full_name: 'Ama', admission_no: 'ALM-2026-001', class_name: 'Basic 3' })
    expect(env.passwords.get('parent-1')).toBe(slips[0].code)
    expect(access[0].code_hash).toBe(await hashCode('s1', slips[0].code))
    expect(JSON.stringify(access)).not.toContain(slips[0].code)
  })

  it('gives a new code to a student who already has one, keeping the same login', async () => {
    const first = (await (await handleParentAccess(req({ action: 'issue', student_ids: ['s1'] }, 'a'), env.client)).json()).slips[0].code
    const second = (await (await handleParentAccess(req({ action: 'issue', student_ids: ['s1'] }, 'a'), env.client)).json()).slips[0].code
    expect(second).not.toBe(first)
    expect(access).toHaveLength(1)
    expect(env.passwords.get('parent-1')).toBe(second)
  })

  it('reports students it could not do, and skips those who are not active', async () => {
    const { slips, failed } = await (await handleParentAccess(req({ action: 'issue', student_ids: ['s1', 's2', 's3'] }, 'a'), env.client)).json()
    expect(slips.map((s: { full_name: string }) => s.full_name)).toEqual(['Ama'])
    expect(failed.map((f: { full_name: string }) => f.full_name).sort()).toEqual(['Esi', 'Kofi'])
  })

  it('refuses an empty list and too many at once', async () => {
    expect((await handleParentAccess(req({ action: 'issue', student_ids: [] }, 'a'), env.client)).status).toBe(400)
    expect((await handleParentAccess(req({ action: 'issue', student_ids: Array.from({ length: 101 }, (_, i) => `x${i}`) }, 'a'), env.client)).status).toBe(400)
  })
})

describe('set_active', () => {
  it('stops and restores a parent login', async () => {
    await handleParentAccess(req({ action: 'issue', student_ids: ['s1'] }, 'a'), env.client)
    expect((await handleParentAccess(req({ action: 'set_active', student_id: 's1', active: false }, 'a'), env.client)).status).toBe(200)
    expect(access[0].active).toBe(false)
    expect(env.bans['parent-1']).not.toBe('none')
    await handleParentAccess(req({ action: 'set_active', student_id: 's1', active: true }, 'a'), env.client)
    expect(env.bans['parent-1']).toBe('none')
  })
  it('says so when there is no access yet', async () => {
    expect((await handleParentAccess(req({ action: 'set_active', student_id: 's1', active: false }, 'a'), env.client)).status).toBe(404)
  })
})

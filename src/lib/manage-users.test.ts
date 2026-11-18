import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { handleManageUsers } from './manage-users'

type Profile = { id: string; auth_user_id: string; role: string; active: boolean; full_name?: string; email?: string }

// A tiny stand-in for the Supabase service client, holding data in memory.
function fakeAdmin(tokens: Record<string, string>, profiles: Profile[]) {
  const authUsers = new Set<string>(Object.values(tokens))
  const calls = { deleted: [] as string[], passwords: [] as string[] }
  const client = {
    auth: {
      getUser: async (token: string) =>
        tokens[token] ? { data: { user: { id: tokens[token] } }, error: null } : { data: { user: null }, error: { message: 'bad' } },
      admin: {
        createUser: async ({ email }: { email: string }) => {
          if (email === 'taken@school.com') return { data: { user: null }, error: { message: 'User already registered' } }
          const id = `auth-${authUsers.size + 1}`
          authUsers.add(id)
          return { data: { user: { id } }, error: null }
        },
        deleteUser: async (id: string) => { calls.deleted.push(id); return { error: null } },
        updateUserById: async (id: string) => { calls.passwords.push(id); return { error: null } },
      },
    },
    from: (_table: string) => {
      let filter: [string, unknown] | null = null
      let patch: Record<string, unknown> | null = null
      let inserted: Profile | null = null
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filter = [col, val]
          if (patch) {
            for (const p of profiles) if ((p as Record<string, unknown>)[col] === val) Object.assign(p, patch)
            return Promise.resolve({ error: null })
          }
          return builder
        },
        update: (p: Record<string, unknown>) => { patch = p; return builder },
        insert: (row: Omit<Profile, 'id' | 'active'>) => {
          inserted = { ...row, id: `p-${profiles.length + 1}`, active: true }
          profiles.push(inserted)
          return builder
        },
        single: async () => ({ data: inserted, error: null }),
        maybeSingle: async () => ({
          data: profiles.find((p) => filter && (p as Record<string, unknown>)[filter[0]] === filter[1]) ?? null,
          error: null,
        }),
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

function request(body: unknown, token?: string, method = 'POST'): Request {
  return new Request('https://example.test/fn', {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
}

const newUser = { action: 'create', email: 'ama@school.com', full_name: 'Ama Mensah', role: 'staff', password: 'abcd1234' }
let profiles: Profile[]
let admin: ReturnType<typeof fakeAdmin>

beforeEach(() => {
  profiles = [
    { id: 'p-admin', auth_user_id: 'u-admin', role: 'admin', active: true },
    { id: 'p-staff', auth_user_id: 'u-staff', role: 'staff', active: true },
    { id: 'p-old', auth_user_id: 'u-old', role: 'admin', active: false },
  ]
  admin = fakeAdmin({ 'tok-admin': 'u-admin', 'tok-staff': 'u-staff', 'tok-old': 'u-old', 'tok-nobody': 'u-nobody' }, profiles)
})

describe('who may call', () => {
  it('rejects a call with no login', async () => {
    expect((await handleManageUsers(request(newUser), admin.client)).status).toBe(401)
  })
  it('rejects a bad login token', async () => {
    expect((await handleManageUsers(request(newUser, 'wrong'), admin.client)).status).toBe(401)
  })
  it('rejects Staff', async () => {
    expect((await handleManageUsers(request(newUser, 'tok-staff'), admin.client)).status).toBe(403)
  })
  it('rejects a deactivated Admin and a login with no profile', async () => {
    expect((await handleManageUsers(request(newUser, 'tok-old'), admin.client)).status).toBe(403)
    expect((await handleManageUsers(request(newUser, 'tok-nobody'), admin.client)).status).toBe(403)
  })
  it('rejects anything but POST', async () => {
    expect((await handleManageUsers(request(null, 'tok-admin', 'GET'), admin.client)).status).toBe(405)
  })
})

describe('create', () => {
  it('lets the Admin create a user with a profile', async () => {
    const res = await handleManageUsers(request(newUser, 'tok-admin'), admin.client)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe('ama@school.com')
    expect(body.user.role).toBe('staff')
    expect(profiles.some((p) => p.email === 'ama@school.com')).toBe(true)
  })
  it('refuses a duplicate email, a bad role and a short password', async () => {
    expect((await handleManageUsers(request({ ...newUser, email: 'taken@school.com' }, 'tok-admin'), admin.client)).status).toBe(409)
    expect((await handleManageUsers(request({ ...newUser, role: 'parent' }, 'tok-admin'), admin.client)).status).toBe(400)
    expect((await handleManageUsers(request({ ...newUser, password: 'x' }, 'tok-admin'), admin.client)).status).toBe(400)
  })
})

describe('deactivate and reset password', () => {
  it('lets the Admin deactivate someone else', async () => {
    const res = await handleManageUsers(request({ action: 'set_active', profile_id: 'p-staff', active: false }, 'tok-admin'), admin.client)
    expect(res.status).toBe(200)
    expect(profiles.find((p) => p.id === 'p-staff')?.active).toBe(false)
  })
  it('stops the Admin deactivating themselves', async () => {
    const res = await handleManageUsers(request({ action: 'set_active', profile_id: 'p-admin', active: false }, 'tok-admin'), admin.client)
    expect(res.status).toBe(400)
    expect(profiles.find((p) => p.id === 'p-admin')?.active).toBe(true)
  })
  it('resets a password only with a valid new one', async () => {
    const bad = await handleManageUsers(request({ action: 'reset_password', profile_id: 'p-staff', password: '123' }, 'tok-admin'), admin.client)
    expect(bad.status).toBe(400)
    const ok = await handleManageUsers(request({ action: 'reset_password', profile_id: 'p-staff', password: 'newpass99' }, 'tok-admin'), admin.client)
    expect(ok.status).toBe(200)
    expect(admin.calls.passwords).toEqual(['u-staff'])
  })
  it('rejects an unknown action', async () => {
    expect((await handleManageUsers(request({ action: 'delete_everything' }, 'tok-admin'), admin.client)).status).toBe(400)
  })
})

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { generatePassword, type UserRole } from '../lib/users'

type UserRow = { id: string; full_name: string; email: string | null; role: UserRole; phone: string | null; active: boolean }

async function callServer(body: unknown): Promise<{ ok: boolean; data?: any; error?: string }> {
  const { data } = await supabase!.auth.getSession()
  try {
    const res = await fetch('/.netlify/functions/manage-users', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? 'Something went wrong.' }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check the internet and try again.' }
  }
}

export default function Users() {
  const { state } = useAuth()
  const myId = state.status === 'ready' ? state.profile.id : ''
  const [users, setUsers] = useState<UserRow[]>([])
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'staff' as UserRole, password: generatePassword() })

  const refresh = useCallback(async () => {
    const { data } = await supabase!.from('profiles').select('id, full_name, email, role, phone, active').order('full_name')
    setUsers((data as UserRow[]) ?? [])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function create(e: FormEvent) {
    e.preventDefault()
    const r = await callServer({ action: 'create', ...form })
    if (!r.ok) return setNotice({ ok: false, text: r.error! })
    setNotice({ ok: true, text: `${form.full_name} can now log in with the email ${form.email.trim().toLowerCase()} and the password ${form.password}. Write the password down and give it to them now: it will not be shown again.` })
    setForm({ full_name: '', email: '', phone: '', role: 'staff', password: generatePassword() })
    refresh()
  }

  async function setActive(u: UserRow, active: boolean) {
    const r = await callServer({ action: 'set_active', profile_id: u.id, active })
    if (!r.ok) return setNotice({ ok: false, text: r.error! })
    refresh()
  }

  async function reset(u: UserRow) {
    const password = generatePassword()
    const r = await callServer({ action: 'reset_password', profile_id: u.id, password })
    setNotice(r.ok ? { ok: true, text: `New password for ${u.full_name}: ${password}. Write it down and give it to them now.` } : { ok: false, text: r.error! })
  }

  const input = 'rounded-lg border border-slate-300 p-3 text-base'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-brand">Users</h1>
      {notice && (
        <p className={`rounded-xl p-4 text-sm ${notice.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{notice.text}</p>
      )}

      <form onSubmit={create} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Add a user</h2>
        <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
        <input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className={input}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex items-center gap-2">
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${input} flex-1 font-mono`} aria-label="Temporary password" />
          <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="rounded-lg border border-slate-300 px-3 py-3 text-sm font-medium">
            New
          </button>
        </div>
        <button className="rounded-lg bg-brand p-3 font-semibold text-white">Create user</button>
      </form>

      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
            <div>
              <p className="font-medium">
                {u.full_name} <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs capitalize">{u.role}</span>
                {!u.active && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Deactivated</span>}
              </p>
              <p className="text-sm text-slate-600">{u.email ?? 'no email on file'}</p>
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => reset(u)} className="rounded-lg border border-slate-300 px-3 py-2">Reset password</button>
              {u.id !== myId && (
                <button onClick={() => setActive(u, !u.active)} className="rounded-lg border border-slate-300 px-3 py-2">
                  {u.active ? 'Deactivate' : 'Activate'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

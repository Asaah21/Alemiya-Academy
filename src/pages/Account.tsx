import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { validatePassword } from '../lib/users'

export default function Account() {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = validatePassword(password)
    if (!v.ok) return setMessage({ ok: false, text: v.error })
    if (password !== again) return setMessage({ ok: false, text: 'The two passwords are not the same.' })
    const { error } = await supabase!.auth.updateUser({ password })
    if (error) return setMessage({ ok: false, text: 'Could not change the password. Please log in again and retry.' })
    setPassword('')
    setAgain('')
    setMessage({ ok: true, text: 'Password changed.' })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">My account</h1>
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Change my password</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          New password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-slate-300 p-3 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type it again
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="rounded-lg border border-slate-300 p-3 text-base" />
        </label>
        {message && (
          <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</p>
        )}
        <button className="rounded-lg bg-brand p-3 font-semibold text-white">Save new password</button>
      </form>
    </div>
  )
}

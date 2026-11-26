import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Archive, Bell, Eye, Megaphone, Users } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { useAuth } from '../features/auth/AuthProvider'
import { friendlyError } from '../lib/errors'
import { BODY_MAX, checkNotice, noticeDate, TITLE_MAX } from '../lib/notices'
import { supabase } from '../lib/supabase'

type Notice = { id: string; title: string; body: string; audience: 'staff' | 'staff_and_parents'; archived: boolean; posted_by_name: string | null; created_at: string }
const input = 'w-full rounded-lg border border-slate-300 p-3 text-base'

export default function Notices() {
  const { state } = useAuth()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const [list, setList] = useState<Notice[] | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', forParents: false })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase!.from('notices').select('id, title, body, audience, archived, posted_by_name, created_at').order('created_at', { ascending: false }).limit(200)
    if (error) { setMsg({ ok: false, text: friendlyError(error, 'Could not load the notices.') }); return setList([]) }
    setList((data ?? []) as Notice[])
  }, [])
  useEffect(() => { load() }, [load])

  async function post(e: FormEvent) {
    e.preventDefault()
    const c = checkNotice(form)
    if (!c.ok) return setMsg({ ok: false, text: c.error })
    setBusy(true); setMsg(null)
    const { error } = await supabase!.from('notices').insert(c.value)
    setBusy(false)
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not post the notice. Please try again.') })
    setForm({ title: '', body: '', forParents: false })
    setMsg({ ok: true, text: 'Notice posted.' })
    load()
  }

  async function hide(n: Notice) {
    if (!window.confirm(`Hide "${n.title}"? It will no longer be shown to anyone.`)) return
    const { error } = await supabase!.from('notices').update({ archived: true }).eq('id', n.id)
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not hide the notice.') })
    setMsg({ ok: true, text: 'Notice hidden.' })
    load()
  }

  const shown = (list ?? []).filter((n) => showHidden || !n.archived)
  const hiddenCount = (list ?? []).filter((n) => n.archived).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notices" subtitle="Messages for staff, and optionally for parents" />
      {msg && <p className={`rounded-xl border p-4 text-sm font-semibold ${msg.ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-800'}`}>{msg.text}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={post} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 lg:self-start">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Megaphone className="h-5 w-5 text-brand" /> Post a notice</h2>
          <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">Title
            <input value={form.title} maxLength={TITLE_MAX} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} placeholder="For example: Staff meeting on Friday" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">Message
            <textarea value={form.body} maxLength={BODY_MAX} rows={5} onChange={(e) => setForm({ ...form, body: e.target.value })} className={input} />
            <span className="self-end text-xs font-medium text-slate-400">{form.body.length} / {BODY_MAX}</span>
          </label>
          <label className="flex items-start gap-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.forParents} onChange={(e) => setForm({ ...form, forParents: e.target.checked })} className="mt-0.5 h-5 w-5" />
            <span>Also show to parents<span className="block text-xs font-medium text-slate-500">Parents see it on their phone page.</span></span>
          </label>
          <button disabled={busy} className="rounded-lg bg-brand p-3.5 font-bold text-white shadow-sm hover:bg-ink disabled:opacity-60">{busy ? 'Posting…' : 'Post notice'}</button>
        </form>

        <section className="flex flex-col gap-3 lg:col-span-3">
          {list === null && <p className="text-sm font-medium text-slate-500">Loading…</p>}
          {list !== null && shown.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Bell className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 font-bold text-slate-700">No notices yet</p>
              <p className="text-sm font-medium text-slate-500">Post the first one using the form.</p>
            </div>
          )}
          {shown.map((n) => (
            <article key={n.id} className={`rounded-xl border bg-white p-5 shadow-sm ${n.archived ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">{n.title}</h3>
                {isAdmin && !n.archived && (
                  <button onClick={() => hide(n)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"><Archive className="h-3.5 w-3.5" /> Hide</button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[15px] font-medium text-slate-700">{n.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span>{n.posted_by_name || 'Staff'} · {noticeDate(n.created_at)}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${n.audience === 'staff_and_parents' ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'}`}>
                  {n.audience === 'staff_and_parents' ? <><Eye className="h-3 w-3" /> Staff and parents</> : <><Users className="h-3 w-3" /> Staff only</>}
                </span>
                {n.archived && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">Hidden</span>}
              </div>
            </article>
          ))}
          {isAdmin && hiddenCount > 0 && (
            <button onClick={() => setShowHidden(!showHidden)} className="self-start text-sm font-bold text-brand hover:underline">{showHidden ? 'Hide old notices' : `Show ${hiddenCount} hidden notice${hiddenCount === 1 ? '' : 's'}`}</button>
          )}
        </section>
      </div>
    </div>
  )
}

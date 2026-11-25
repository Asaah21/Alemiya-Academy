import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'

// Shows whether a class's results are published, and lets the Admin publish or take them back (rule C3).
export default function PublishPanel({ classId, termId, complete }: { classId: string; termId: string; complete: boolean }) {
  const { state } = useAuth()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const [publishedAt, setPublishedAt] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const { data, error } = await supabase!.from('results_publish').select('published_at').eq('class_id', classId).eq('term_id', termId).maybeSingle()
    setPublishedAt(error ? undefined : (data?.published_at ?? null))
  }
  useEffect(() => { setPublishedAt(undefined); setMessage(null); load() }, [classId, termId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn: 'publish_results' | 'unpublish_results') {
    if (fn === 'unpublish_results' && !window.confirm('Take these results back? Parents will no longer see them, and scores can be corrected again.')) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase!.rpc(fn, { p_class: classId, p_term: termId })
    setBusy(false)
    if (error) setMessage({ ok: false, text: friendlyError(error) })
    else setMessage({ ok: true, text: fn === 'publish_results' ? 'Results published.' : 'Results taken back.' })
    await load()
  }

  if (publishedAt === undefined) return null
  const date = publishedAt ? new Date(publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
      <p className="font-medium">{publishedAt ? `Published on ${date}. Parents can see these results.` : 'Not published. Parents cannot see these results yet.'}</p>
      {publishedAt && <p className="text-sm text-slate-600">Scores and remarks are locked while results are published.</p>}
      {isAdmin && (publishedAt ? (
        <button onClick={() => act('unpublish_results')} disabled={busy} className="rounded-lg border border-slate-300 p-3 font-medium disabled:opacity-60">Take results back (unpublish)</button>
      ) : (
        <>
          <button onClick={() => act('publish_results')} disabled={busy || !complete} className="rounded-lg bg-brand p-3 font-semibold text-white disabled:opacity-50">Publish results to parents</button>
          {!complete && <p className="text-sm text-amber-800">Publishing is possible once every score is entered.</p>}
        </>
      ))}
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{message.text}</p>}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Download, ExternalLink, FileText, Upload } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'
import { friendlyError } from '../lib/errors'
import { noticeDate } from '../lib/notices'
import { supabase } from '../lib/supabase'
import { ACCEPT, checkTimetableFile, fileKind, isImage, sizeLabel, storagePath } from '../lib/timetable'

type Row = {
  id: string; term_id: string; file_path: string; file_name: string; content_type: string | null; size_bytes: number | null
  uploaded_by_name: string | null; created_at: string
  terms: { name: string; academic_years: { name: string } | { name: string }[] | null } | { name: string; academic_years: { name: string } | { name: string }[] | null }[] | null
}
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
const termLabel = (r: Row) => { const t = one(r.terms); const y = t ? one(t.academic_years) : null; return t ? `${t.name}${y ? `, ${y.name}` : ''}` : '' }

export default function Timetable() {
  const { state } = useAuth()
  const { currentTerm } = useSchool()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const [rows, setRows] = useState<Row[] | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase!.from('timetables')
      .select('id, term_id, file_path, file_name, content_type, size_bytes, uploaded_by_name, created_at, terms(name, academic_years(name))')
      .eq('archived', false).order('created_at', { ascending: false })
    if (error) { setMsg({ ok: false, text: friendlyError(error, 'Could not load the timetable.') }); return setRows([]) }
    setRows((data ?? []) as unknown as Row[])
  }, [])
  useEffect(() => { load() }, [load])

  const current = rows?.find((r) => r.term_id === currentTerm?.id) ?? null
  const earlier = (rows ?? []).filter((r) => r.id !== current?.id)

  useEffect(() => {
    setPreview(null)
    if (current && (isImage(current.content_type) || current.content_type === 'application/pdf')) {
      supabase!.storage.from('timetables').createSignedUrl(current.file_path, 3600).then(({ data }) => setPreview(data?.signedUrl ?? null))
    }
  }, [current?.id, current?.file_path, current?.content_type])

  async function open(r: Row, download: boolean) {
    const { data, error } = await supabase!.storage.from('timetables').createSignedUrl(r.file_path, 300, download ? { download: r.file_name } : undefined)
    if (error || !data) return setMsg({ ok: false, text: friendlyError(error, 'Could not open the file. Please try again.') })
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function upload(e: FormEvent) {
    e.preventDefault()
    if (!currentTerm) return setMsg({ ok: false, text: 'Set the current term first (Set up, then Current term).' })
    if (!file) return setMsg({ ok: false, text: 'Choose a file first.' })
    const c = checkTimetableFile(file)
    if (!c.ok) return setMsg({ ok: false, text: c.error })
    setBusy(true); setMsg(null)
    const path = storagePath(currentTerm.id, file.name)
    const up = await supabase!.storage.from('timetables').upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) { setBusy(false); return setMsg({ ok: false, text: friendlyError(up.error, 'The file could not be uploaded. Please try again.') }) }
    const ins = await supabase!.from('timetables').insert({ term_id: currentTerm.id, file_path: path, file_name: file.name, content_type: file.type, size_bytes: file.size })
    if (ins.error) { setBusy(false); return setMsg({ ok: false, text: friendlyError(ins.error, 'The file was uploaded but could not be saved. Please try again.') }) }
    // The new file replaces the older ones for this term (older files stay stored).
    await supabase!.from('timetables').update({ archived: true }).eq('term_id', currentTerm.id).eq('archived', false).neq('file_path', path)
    setBusy(false); setFile(null)
    if (fileInput.current) fileInput.current.value = ''
    setMsg({ ok: true, text: 'Timetable uploaded.' })
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Timetable" subtitle={currentTerm ? `${currentTerm.name}, ${currentTerm.year_name}` : 'One document for the whole term'} />
      {msg && <p className={`rounded-xl border p-4 text-sm font-semibold ${msg.ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-800'}`}>{msg.text}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-5">
          <h2 className="border-b border-slate-100 px-5 py-4 text-base font-bold text-slate-900">This term's timetable</h2>
          {rows === null ? <p className="p-5 text-sm font-medium text-slate-500">Loading…</p> : !current ? (
            <div className="p-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 font-bold text-slate-700">No timetable uploaded yet</p>
              <p className="text-sm font-medium text-slate-500">{isAdmin ? 'Upload the term timetable using the form.' : 'The Admin has not uploaded it yet.'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><FileText className="h-6 w-6" /></span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{current.file_name}</p>
                  <p className="text-sm font-medium text-slate-500">{fileKind(current.content_type)} · {sizeLabel(current.size_bytes)} · {current.uploaded_by_name || 'Admin'}, {noticeDate(current.created_at)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => open(current, false)} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-3 font-bold text-white shadow-sm hover:bg-ink"><ExternalLink className="h-4 w-4" /> View</button>
                <button onClick={() => open(current, true)} className="flex items-center gap-2 rounded-lg border-2 border-slate-300 px-4 py-3 font-bold text-slate-700"><Download className="h-4 w-4" /> Download</button>
              </div>
              {preview && (isImage(current.content_type)
                ? <img src={preview} alt="Timetable" className="w-full rounded-lg border border-slate-200" />
                : <iframe src={preview} title="Timetable" className="h-[85vh] w-full rounded-lg border border-slate-200" />)}
              {!preview && !isImage(current.content_type) && current.content_type !== 'application/pdf' && <p className="rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-600">This kind of file cannot be shown here. Press View or Download to open it.</p>}
            </div>
          )}
        </section>

        {isAdmin && (
          <form onSubmit={upload} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Upload className="h-5 w-5 text-brand" /> {current ? 'Replace the timetable' : 'Upload the timetable'}</h2>
            <p className="text-sm font-medium text-slate-500">A PDF, picture or Word file, up to 10 MB. {current ? 'The new file replaces the one above; the old file is kept safely.' : ''}</p>
            <input ref={fileInput} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-bold" />
            <button disabled={busy || !file} className="rounded-lg bg-brand p-3.5 font-bold text-white shadow-sm hover:bg-ink disabled:opacity-50">{busy ? 'Uploading…' : 'Upload'}</button>
          </form>
        )}
      </div>

      {earlier.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-5 py-4 text-base font-bold text-slate-900">Earlier terms</h2>
          <ul className="divide-y divide-slate-100">
            {earlier.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{termLabel(r)}</p>
                  <p className="truncate text-sm font-medium text-slate-500">{r.file_name} · {noticeDate(r.created_at)}</p>
                </div>
                <button onClick={() => open(r, false)} className="shrink-0 rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">View</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

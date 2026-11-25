import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadPdf } from '../features/reportcard/pdf'
import { loadClassCards } from '../features/reportcard/load'
import ReportCard from '../features/reportcard/ReportCard'
import { useSchool } from '../features/school/SchoolProvider'
import { ordinal, type ClassCards } from '../lib/report-card'
import { supabase } from '../lib/supabase'

type Term = { id: string; name: string; academic_years: { name: string } | { name: string }[] | null }


const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const btn = 'rounded-lg border border-slate-300 px-4 py-3 font-medium'
const A4_PX = 794 // 210 mm at 96 dpi

export default function ReportCards() {
  const { currentTerm } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [data, setData] = useState<ClassCards | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'one'; id: string } | { kind: 'all' }>({ kind: 'list' })
  const [busy, setBusy] = useState(false)
  const [scale, setScale] = useState(1)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      supabase!.from('classes').select('id, name').order('level_order'),
      supabase!.from('terms').select('id, name, academic_years(name)').order('start_date', { ascending: false }),
    ]).then(([c, t]) => { setClasses(c.data ?? []); setTerms((t.data as unknown as Term[]) ?? []) })
  }, [])
  useEffect(() => { if (!termId && currentTerm) setTermId(currentTerm.id) }, [currentTerm, termId])

  useEffect(() => {
    setData(null)
    setMode({ kind: 'list' })
    if (!classId || !termId) return
    setLoading(true)
    setError(false)
    loadClassCards(classId, termId).then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }, [classId, termId])

  // shrink the A4 page to fit a phone screen (the real size is kept for print and PDF)
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 32) / A4_PX))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const shown = useMemo(() => {
    if (!data) return []
    if (mode.kind === 'one') return data.cards.filter((c) => c.studentId === mode.id)
    if (mode.kind === 'all') return data.cards
    return []
  }, [data, mode])

  async function pdf() {
    const cards = sheetRef.current?.querySelectorAll<HTMLElement>('[data-report-card]')
    if (!cards?.length || !data) return
    setBusy(true)
    try {
      const name = mode.kind === 'one' ? shown[0].studentName : `${shown[0].className}`
      await downloadPdf(Array.from(cards), `Report-${name.replace(/[^A-Za-z0-9]+/g, '-')}-${shown[0].termName.replace(/\s+/g, '')}.pdf`)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Report Cards</h1>
        <Link to="/scores/results" className="text-sm underline">Class results</Link>
      </div>

      <div className="flex flex-col gap-4 print:hidden">
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
          <option value="">Choose the term</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
        </select>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
          <option value="">Choose the class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Something went wrong. Please try again.</p>}
        {loading && <p className="text-slate-600">Loading…</p>}
      </div>

      {data && !loading && (
        data.cards.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm print:hidden">There are no active students in this class.</p>
        : !data.ready ? (
          <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900 print:hidden">
            <p className="font-medium">Report cards cannot be produced yet. {data.missing.length} score{data.missing.length === 1 ? ' is' : 's are'} missing:</p>
            <ul className="mt-2 list-disc pl-5">
              {data.missing.slice(0, 40).map((m, i) => <li key={i}>{m.name}: {m.subject} ({m.what})</li>)}
            </ul>
            {data.missing.length > 40 && <p className="mt-1">…and {data.missing.length - 40} more.</p>}
            <Link to="/scores" className="mt-2 inline-block underline">Go to Enter Scores</Link>
          </div>
        ) : mode.kind === 'list' ? (
          <div className="flex flex-col gap-3 print:hidden">
            <button onClick={() => setMode({ kind: 'all' })} className="rounded-lg bg-brand p-3 font-semibold text-white">Open all {data.cards.length} cards (print or download)</button>
            <ul className="flex flex-col gap-2">
              {[...data.cards].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.studentName.localeCompare(b.studentName)).map((c) => (
                <li key={c.studentId}>
                  <button onClick={() => setMode({ kind: 'one', id: c.studentId })} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm">
                    <span><span className="block font-medium">{c.studentName}</span><span className="text-sm text-slate-600">{c.admissionNo}</span></span>
                    {c.position && <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold">{ordinal(c.position)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex flex-wrap gap-2 bg-slate-50 py-2 print:hidden">
              <button onClick={() => setMode({ kind: 'list' })} className={btn}>Back</button>
              <button onClick={() => window.print()} className={btn}>Print</button>
              <button onClick={pdf} disabled={busy} className={`${btn} disabled:opacity-60`}>{busy ? 'Preparing PDF…' : 'Download PDF'}</button>
            </div>
            <div className="overflow-hidden print:overflow-visible">
              <div ref={sheetRef} className="rc-sheet" data-rc-scale style={{ width: A4_PX, transform: `scale(${scale})`, transformOrigin: 'top left', height: `${1123 * shown.length * scale}px` }}>
                {shown.map((c) => <ReportCard key={c.studentId} card={c} />)}
              </div>
            </div>
          </>
        )
      )}
    </div>
  )
}

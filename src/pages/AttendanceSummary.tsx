import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchool } from '../features/school/SchoolProvider'
import { classRate, schoolRate, studentRate, weeksDue, weeksNotRecorded, type Rate, type Totals } from '../lib/attendance'
import { formatDate } from '../lib/terms'
import { supabase } from '../lib/supabase'

type Term = { id: string; name: string; start_date: string; end_date: string; academic_years: { name: string } | { name: string }[] | null }
type Cls = { id: string; name: string; level_order: number }

const yearName = (t: Term) => (Array.isArray(t.academic_years) ? t.academic_years[0]?.name : t.academic_years?.name) ?? ''
const show = (r: Rate) => (r.rate === null ? 'No data' : `${r.rate}%`)
const today = () => new Date().toISOString().slice(0, 10)

export default function AttendanceSummary() {
  const { currentTerm } = useSchool()
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [classes, setClasses] = useState<Cls[]>([])
  const [totals, setTotals] = useState<Totals[]>([])
  const [weeks, setWeeks] = useState<{ class_id: string; week_start: string }[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase!.from('terms').select('id, name, start_date, end_date, academic_years(name)').order('start_date', { ascending: false }),
      supabase!.from('classes').select('id, name, level_order').order('level_order'),
    ]).then(([t, c]) => {
      setTerms((t.data as unknown as Term[]) ?? [])
      setClasses((c.data as Cls[]) ?? [])
    })
  }, [])

  useEffect(() => {
    if (!termId && terms.length) setTermId(currentTerm?.id ?? terms[0].id)
  }, [terms, currentTerm, termId])

  useEffect(() => {
    if (!termId) return
    setLoading(true)
    setError(false)
    setOpen(null)
    Promise.all([
      supabase!.rpc('attendance_term_totals', { p_term: termId }),
      supabase!.from('attendance_weeks').select('class_id, week_start').eq('term_id', termId),
    ]).then(([t, w]) => {
      if (t.error || w.error) setError(true)
      setTotals(((t.data ?? []) as Totals[]).map((r) => ({ ...r, weeks: Number(r.weeks), school_days: Number(r.school_days), days_absent: Number(r.days_absent) })))
      setWeeks((w.data as { class_id: string; week_start: string }[]) ?? [])
      setLoading(false)
    })
  }, [termId])

  const term = terms.find((t) => t.id === termId)
  const due = useMemo(() => (term ? weeksDue(term, today()) : []), [term])
  const missing = (classId: string) => weeksNotRecorded(due, weeks.filter((w) => w.class_id === classId).map((w) => w.week_start))

  async function toggle(c: Cls) {
    if (open === c.id) return setOpen(null)
    setOpen(c.id)
    const ids = totals.filter((t) => t.class_id === c.id).map((t) => t.student_id)
    if (ids.length) {
      const { data } = await supabase!.from('students').select('id, full_name').in('id', ids)
      setNames((n) => ({ ...n, ...Object.fromEntries((data ?? []).map((s) => [s.id, s.full_name])) }))
    }
  }

  const input = 'rounded-lg border border-slate-300 p-3 text-base'
  const school = schoolRate(totals)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-brand">Attendance summary</h1>
        <Link to="/attendance" className="text-sm underline">Enter attendance</Link>
      </div>

      <select value={termId} onChange={(e) => setTermId(e.target.value)} className={input} aria-label="Term">
        {terms.map((t) => <option key={t.id} value={t.id}>{t.name}, {yearName(t)}</option>)}
      </select>

      {error && <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">Could not load attendance. Please try again.</p>}
      {loading && <p className="text-slate-600">Loading…</p>}

      {!loading && !error && term && (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Whole school, recorded weeks only</p>
            <p className="text-3xl font-bold text-brand">{show(school)}</p>
          </div>
          <p className="text-xs text-slate-500">
            Rate = days present ÷ school days, counting only weeks that were saved. A week with no saved entry is left out, not counted as absent.
          </p>
          <ul className="flex flex-col gap-2">
            {classes.map((c) => {
              const r = classRate(totals, c.id)
              const m = missing(c.id)
              const students = totals.filter((t) => t.class_id === c.id)
              return (
                <li key={c.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <button onClick={() => toggle(c)} className="flex w-full items-center justify-between gap-2 text-left">
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      <span className={`text-sm ${m.length ? 'text-amber-800' : 'text-slate-600'}`}>
                        {m.length ? `${m.length} week${m.length === 1 ? '' : 's'} not recorded` : 'All due weeks recorded'}
                      </span>
                    </span>
                    <span className="text-lg font-semibold">{show(r)}</span>
                  </button>
                  {open === c.id && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 text-sm">
                      {m.length > 0 && (
                        <div>
                          <p className="font-medium">Weeks not recorded (left out of the rate)</p>
                          <ul className="mt-1 flex flex-wrap gap-2">
                            {m.map((w) => <li key={w} className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">Week of {formatDate(w)}</li>)}
                          </ul>
                        </div>
                      )}
                      {students.length === 0 ? <p className="text-slate-600">No attendance saved for this class yet.</p> : (
                        <ul className="flex flex-col gap-1">
                          {[...students].sort((a, b) => (names[a.student_id] ?? '').localeCompare(names[b.student_id] ?? '')).map((s) => {
                            const sr = studentRate(totals, s.student_id)
                            return (
                              <li key={s.student_id} className="flex justify-between">
                                <span>{names[s.student_id] ?? '…'}</span>
                                <span>{sr.daysPresent} of {sr.schoolDays} days · <strong>{show(sr)}</strong></span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

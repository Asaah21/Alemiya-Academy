import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchool } from '../features/school/SchoolProvider'
import { weeksDue, weeksNotRecorded } from '../lib/attendance'
import { formatDate } from '../lib/terms'
import { addDays, checkWeek, mondayOf, weekLabel } from '../lib/weeks'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

type Student = { id: string; full_name: string; admission_no: string }

const btn = 'rounded-lg border border-slate-300 px-4 py-3 text-base font-medium'
const today = () => new Date().toISOString().slice(0, 10)

export default function WeeklyAttendance() {
  const { currentTerm } = useSchool()
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [classId, setClassId] = useState('')
  const [week, setWeek] = useState(mondayOf(today()))
  const [students, setStudents] = useState<Student[]>([])
  const [absent, setAbsent] = useState<Record<string, number>>({})
  const [schoolDays, setSchoolDays] = useState(5)
  const [recorded, setRecorded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bad, setBad] = useState<string[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  useEffect(() => {
    supabase!.from('classes').select('id, name').order('level_order').then(({ data }) => setClasses(data ?? []))
  }, [])

  const load = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    setMsg(null)
    setBad([])
    const [s, w] = await Promise.all([
      supabase!.from('students').select('id, full_name, admission_no').eq('class_id', classId).eq('status', 'active').order('full_name'),
      supabase!.from('attendance_weeks').select('id, school_days').eq('class_id', classId).eq('week_start', week).maybeSingle(),
    ])
    let entries: { student_id: string; days_absent: number }[] = []
    if (w.data) {
      const e = await supabase!.from('attendance_entries').select('student_id, days_absent').eq('week_id', w.data.id)
      entries = e.data ?? []
    }
    const map: Record<string, number> = {}
    for (const st of (s.data as Student[]) ?? []) map[st.id] = entries.find((x) => x.student_id === st.id)?.days_absent ?? 0
    setStudents((s.data as Student[]) ?? [])
    setAbsent(map)
    setSchoolDays(w.data?.school_days ?? 5)
    setRecorded(Boolean(w.data))
    setLoading(false)
  }, [classId, week])

  useEffect(() => { load() }, [load])

  // Weeks of the current term that should be recorded by now but have no saved entry (rules A6, A9).
  const loadMissing = useCallback(async () => {
    if (!classId || !currentTerm) return setMissing([])
    const { data } = await supabase!.from('attendance_weeks').select('week_start').eq('class_id', classId).eq('term_id', currentTerm.id)
    setMissing(weeksNotRecorded(weeksDue(currentTerm, today()), (data ?? []).map((w) => w.week_start)))
  }, [classId, currentTerm])
  useEffect(() => { loadMissing() }, [loadMissing, recorded])

  const totalAbsent = useMemo(() => Object.values(absent).filter((d) => d > 0).length, [absent])

  async function save() {
    const check = checkWeek(schoolDays, absent)
    if (!check.ok) {
      setBad(check.studentIds)
      return setMsg({ ok: false, text: check.error })
    }
    setBad([])
    const entries = students.map((s) => ({ student_id: s.id, days_absent: absent[s.id] ?? 0 }))
    const { error } = await supabase!.rpc('save_attendance_week', { p_class: classId, p_week_start: week, p_school_days: schoolDays, p_entries: entries })
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not save. Please try again.') })
    setRecorded(true)
    setMsg({ ok: true, text: `Saved. ${totalAbsent === 0 ? 'Everyone was present all week.' : `${totalAbsent} student${totalAbsent === 1 ? ' was' : 's were'} absent; all others were present.`}` })
  }

  const input = 'rounded-lg border border-slate-300 p-3 text-base'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Weekly Attendance</h1>
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        Fill this in on Friday. Choose the class, then pick how many days each student was absent. Students you leave at 0 count as present every day.
      </p>

      <Link to="/attendance/summary" className="text-sm underline">See attendance rates</Link>

      <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
        <option value="">Choose the class</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button onClick={() => setWeek(addDays(week, -7))} className={btn} aria-label="Previous week">◀</button>
        <div className="text-center">
          <p className="font-semibold">{weekLabel(week)}</p>
          {week !== mondayOf(today()) && <button onClick={() => setWeek(mondayOf(today()))} className="text-sm underline">Go to this week</button>}
        </div>
        <button onClick={() => setWeek(addDays(week, 7))} className={btn} aria-label="Next week">▶</button>
      </div>

      {classId && missing.length > 0 && (
        <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
          <p className="font-medium">{missing.length} week{missing.length === 1 ? '' : 's'} not recorded this term. Tap one to fill it in:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((w) => (
              <li key={w}><button onClick={() => setWeek(w)} className="rounded-full bg-white px-3 py-1 font-medium">Week of {formatDate(w)}</button></li>
            ))}
          </ul>
        </div>
      )}

      {!currentTerm && <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">No current term is set. Ask the Admin to set it up.</p>}

      {classId && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="flex items-center gap-3 text-sm font-medium">
              School days this week
              <select value={schoolDays} onChange={(e) => setSchoolDays(Number(e.target.value))} className={input}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${recorded ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
              {recorded ? 'Recorded' : 'Not recorded yet'}
            </span>
          </div>

          {loading ? (
            <p className="text-slate-600">Loading…</p>
          ) : students.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">There are no active students in this class.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {students.map((s) => {
                const d = absent[s.id] ?? 0
                return (
                  <li key={s.id} className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${bad.includes(s.id) ? 'ring-2 ring-red-500' : ''}`}>
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-sm text-slate-600">{s.admission_no} · present {Math.max(schoolDays - d, 0)} of {schoolDays}</p>
                    </div>
                    <label className="flex flex-col items-center text-xs text-slate-600">
                      Days absent
                      <select value={d} onChange={(e) => setAbsent({ ...absent, [s.id]: Number(e.target.value) })} className={`${input} w-20 text-center`}>
                        {Array.from({ length: Math.max(schoolDays, d) + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
          {students.length > 0 && !loading && (
            <button onClick={save} className="sticky bottom-3 rounded-lg bg-brand p-4 text-base font-semibold text-white shadow-lg">
              {recorded ? 'Save changes' : 'Save week'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

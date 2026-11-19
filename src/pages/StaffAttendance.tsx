import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSchool } from '../features/school/SchoolProvider'
import { daysNotRecorded, isWeekend, schoolDaysUpTo, STAFF_STATUSES, type StaffStatus } from '../lib/staff-attendance'
import { formatDate } from '../lib/terms'
import { addDays } from '../lib/weeks'
import { supabase } from '../lib/supabase'

type Person = { id: string; full_name: string; status: 'active' | 'inactive' }
type Mark = { status: StaffStatus; note: string }

const today = () => new Date().toISOString().slice(0, 10)
const btn = 'rounded-lg border border-slate-300 px-4 py-3 text-base font-medium'
const input = 'rounded-lg border border-slate-300 p-3 text-base'
const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function StaffAttendance() {
  const { currentTerm } = useSchool()
  const [date, setDate] = useState(today())
  const [people, setPeople] = useState<Person[]>([])
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [recorded, setRecorded] = useState(false)
  const [holiday, setHoliday] = useState<{ reason: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    const [p, a, h] = await Promise.all([
      supabase!.from('staff').select('id, full_name, status').order('full_name'),
      supabase!.from('staff_attendance').select('staff_id, status, note').eq('attendance_date', date),
      supabase!.from('non_school_days').select('reason').eq('non_school_date', date).maybeSingle(),
    ])
    const saved = new Map((a.data ?? []).map((r) => [r.staff_id as string, r]))
    // active staff, plus anyone inactive who already has an entry for this day
    const list = ((p.data as Person[]) ?? []).filter((x) => x.status === 'active' || saved.has(x.id))
    const m: Record<string, Mark> = {}
    for (const x of list) {
      const s = saved.get(x.id)
      m[x.id] = { status: (s?.status as StaffStatus) ?? 'present', note: s?.note ?? '' }
    }
    setPeople(list)
    setMarks(m)
    setRecorded((a.data ?? []).length > 0)
    setHoliday(h.data ? { reason: h.data.reason } : null)
    setLoading(false)
  }, [date])
  useEffect(() => { load() }, [load])

  const loadMissing = useCallback(async () => {
    if (!currentTerm) return setMissing([])
    const [a, h] = await Promise.all([
      supabase!.from('staff_attendance').select('attendance_date').eq('term_id', currentTerm.id),
      supabase!.from('non_school_days').select('non_school_date').gte('non_school_date', currentTerm.start_date).lte('non_school_date', currentTerm.end_date),
    ])
    const due = schoolDaysUpTo(currentTerm, today(), (h.data ?? []).map((x) => x.non_school_date))
    setMissing(daysNotRecorded(due, Array.from(new Set((a.data ?? []).map((x) => x.attendance_date as string)))))
  }, [currentTerm])
  useEffect(() => { loadMissing() }, [loadMissing, recorded, holiday])

  const exceptions = useMemo(() => Object.values(marks).filter((m) => m.status !== 'present').length, [marks])

  async function save() {
    const entries = people.map((p) => ({ staff_id: p.id, status: marks[p.id].status, note: marks[p.id].note }))
    const { error } = await supabase!.rpc('save_staff_attendance', { p_date: date, p_entries: entries })
    if (error) return setMsg({ ok: false, text: error.message || 'Could not save. Please try again.' })
    setRecorded(true)
    setMsg({ ok: true, text: exceptions === 0 ? 'Saved. Everyone was present.' : `Saved. ${exceptions} exception${exceptions === 1 ? '' : 's'} recorded; everyone else was present.` })
  }

  async function markHoliday() {
    const reason = window.prompt('Why is there no school on this day? (for example Public holiday)', '')
    if (reason === null) return
    const { error } = await supabase!.rpc('set_non_school_day', { p_date: date, p_reason: reason })
    if (error) return setMsg({ ok: false, text: error.message })
    setMsg({ ok: true, text: 'Marked as a non-school day. It is left out of attendance rates.' })
    load()
  }

  async function clearHoliday() {
    if (!window.confirm('Make this a school day again?')) return
    const { error } = await supabase!.from('non_school_days').delete().eq('non_school_date', date)
    if (error) return setMsg({ ok: false, text: 'Could not change this day.' })
    load()
  }

  const setMark = (id: string, patch: Partial<Mark>) => setMarks({ ...marks, [id]: { ...marks[id], ...patch } })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Staff Attendance</h1>
      <p className="rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">
        Everyone starts as Present. Tap only the people who were absent, late or on leave, then Save the day.
      </p>

      <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
        <button onClick={() => setDate(addDays(date, -1))} className={btn} aria-label="Previous day">◀</button>
        <div className="text-center">
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${input} text-center`} aria-label="Date" />
          <p className="mt-1 text-sm text-slate-600">{dayLabel(date)}</p>
          {date !== today() && <button onClick={() => setDate(today())} className="text-sm underline">Go to today</button>}
        </div>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} className={`${btn} disabled:opacity-40`} aria-label="Next day">▶</button>
      </div>

      {missing.length > 0 && (
        <div className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
          <p className="font-medium">{missing.length} school day{missing.length === 1 ? '' : 's'} not recorded this term. Tap one to fill it in:</p>
          <ul className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {missing.map((d) => (
              <li key={d}><button onClick={() => setDate(d)} className="rounded-full bg-white px-3 py-1 font-medium">{formatDate(d)}</button></li>
            ))}
          </ul>
        </div>
      )}

      {loading ? <p className="text-slate-600">Loading…</p> : holiday ? (
        <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="font-semibold">Non-school day{holiday.reason ? `: ${holiday.reason}` : ''}</p>
          <p className="text-sm text-slate-600">This day is left out of staff attendance rates.</p>
          <button onClick={clearHoliday} className={btn}>Make this a school day again</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${recorded ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
              {recorded ? 'Recorded' : 'Not recorded yet'}
            </span>
            {isWeekend(date) && <span className="text-xs text-amber-800">This is a weekend.</span>}
          </div>

          {people.length === 0 ? (
            <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">There are no active staff. Add them under Setup, Staff list.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {people.map((p) => {
                const m = marks[p.id]
                return (
                  <li key={p.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm">
                    <p className="font-medium">{p.full_name}{p.status === 'inactive' && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">Inactive</span>}</p>
                    <div className="grid grid-cols-4 gap-1" role="group" aria-label={`Attendance for ${p.full_name}`}>
                      {STAFF_STATUSES.map((s) => (
                        <button key={s.value} onClick={() => setMark(p.id, { status: s.value })} aria-pressed={m.status === s.value}
                          className={`rounded-lg border px-1 py-3 text-sm font-medium ${m.status === s.value ? (s.value === 'present' ? 'border-green-600 bg-green-600 text-white' : 'border-amber-600 bg-amber-500 text-white') : 'border-slate-300 bg-white'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    {m.status !== 'present' && (
                      <input placeholder="Note (optional)" value={m.note} onChange={(e) => setMark(p.id, { note: e.target.value })} className={input} />
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
          {people.length > 0 && (
            <button onClick={save} className="sticky bottom-3 rounded-lg bg-brand p-4 text-base font-semibold text-white shadow-lg">
              {recorded ? 'Save changes' : 'Save day'}
            </button>
          )}
          {!recorded && <button onClick={markHoliday} className={btn}>Mark as a non-school day (holiday or closure)</button>}
        </>
      )}
      {!loading && holiday === null && msg && !msg.ok && people.length === 0 && <p className="text-sm text-red-800">{msg.text}</p>}
    </div>
  )
}

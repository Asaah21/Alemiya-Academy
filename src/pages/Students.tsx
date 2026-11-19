import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { classRoll, filterStudents, STATUS_LABELS } from '../lib/students'
import { supabase } from '../lib/supabase'

type Row = { id: string; admission_no: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; class_id: string | null; status: string }
type Cls = { id: string; name: string }

export default function Students() {
  const { state } = useAuth()
  const isAdmin = state.status === 'ready' && state.profile.role === 'admin'
  const [rows, setRows] = useState<Row[]>([])
  const [classes, setClasses] = useState<Cls[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState('')
  const [status, setStatus] = useState('active')

  useEffect(() => {
    Promise.all([
      supabase!.from('students').select('id, admission_no, full_name, guardian_name, guardian_phone, class_id, status').order('full_name'),
      supabase!.from('classes').select('id, name').order('level_order'),
    ]).then(([s, c]) => {
      setRows((s.data as Row[]) ?? [])
      setClasses((c.data as Cls[]) ?? [])
      setLoaded(true)
    })
  }, [])

  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])
  const roll = classRoll(rows)
  const shown = filterStudents(rows, { search, classId, status })
  const input = 'rounded-lg border border-slate-300 p-3 text-base'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Students</h1>
        <div className="flex gap-2">
          {isAdmin && <Link to="/students/import" className="rounded-lg border border-slate-300 px-4 py-3 font-medium">Import</Link>}
          <Link to="/students/new" className="rounded-lg bg-brand px-4 py-3 font-semibold text-white">Add student</Link>
        </div>
      </div>
      <input type="search" placeholder="Search name, number or guardian" value={search} onChange={(e) => setSearch(e.target.value)} className={input} />
      <div className="grid grid-cols-2 gap-2">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input} aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({roll.get(c.id) ?? 0})</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input} aria-label="Status">
          <option value="active">Active</option>
          <option value="">All students</option>
          <option value="transferred_out">Transferred out</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="graduated">Graduated</option>
        </select>
      </div>
      {loaded && <p className="text-sm text-slate-600">{shown.length} student{shown.length === 1 ? '' : 's'}</p>}
      <ul className="flex flex-col gap-2">
        {shown.map((s) => (
          <li key={s.id}>
            <Link to={`/students/${s.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
              <div>
                <p className="font-medium">{s.full_name}</p>
                <p className="text-sm text-slate-600">{s.admission_no} · {s.class_id ? className.get(s.class_id) : 'No class'}</p>
              </div>
              {s.status !== 'active' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{STATUS_LABELS[s.status]}</span>}
            </Link>
          </li>
        ))}
        {loaded && shown.length === 0 && <li className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">No students found.</li>}
      </ul>
    </div>
  )
}

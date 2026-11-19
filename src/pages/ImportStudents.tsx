import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { readSheet } from 'read-excel-file/browser'
import { checkImport, parseCsv, TEMPLATE_CSV, toRecords, type ImportCheck } from '../lib/student-import'
import { supabase } from '../lib/supabase'

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export default function ImportStudents() {
  const [fileName, setFileName] = useState('')
  const [check, setCheck] = useState<ImportCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function downloadTemplate() {
    const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'students-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setMsg(null)
    setCheck(null)
    if (!file) return
    setFileName(file.name)
    setBusy(true)
    try {
      let rows: string[][]
      if (/\.xlsx$/i.test(file.name)) {
        const sheet = await readSheet(file, 1)
        rows = sheet.map((r) => r.map(cellText))
      } else if (/\.csv$/i.test(file.name)) {
        rows = parseCsv(await file.text())
      } else {
        setMsg({ ok: false, text: 'Choose an Excel (.xlsx) or CSV (.csv) file. Old .xls files must be saved as .xlsx first.' })
        return
      }
      const [c, s] = await Promise.all([
        supabase!.from('classes').select('id, name'),
        supabase!.from('students').select('admission_no, full_name, date_of_birth'),
      ])
      if (c.error || s.error) {
        setMsg({ ok: false, text: 'Could not check the file against the school records. Please try again.' })
        return
      }
      setCheck(checkImport(toRecords(rows), c.data ?? [], s.data ?? []))
    } catch {
      setMsg({ ok: false, text: 'This file could not be read. Use the template, saved as .xlsx or .csv.' })
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!check || check.errors.length > 0 || check.ready.length === 0) return
    setBusy(true)
    // One request: either every student is saved or none is.
    const { error } = await supabase!.from('students').insert(check.ready)
    setBusy(false)
    if (error) return setMsg({ ok: false, text: 'Nothing was imported because the database refused the file. Please check it and try again.' })
    setMsg({ ok: true, text: `${check.ready.length} students imported.` })
    setCheck(null)
    setFileName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import students</h1>
        <Link to="/students" className="text-sm underline">Back to students</Link>
      </div>

      <ol className="flex flex-col gap-2 rounded-xl bg-white p-4 text-sm shadow-sm">
        <li>1. Download the template and open it in Excel.</li>
        <li>2. Fill in one student per row. Class names must match Setup, Classes (for example Basic 3). Leave Admission number empty: it is given automatically.</li>
        <li>3. Save as Excel (.xlsx) or CSV, then choose the file below.</li>
      </ol>

      <button onClick={downloadTemplate} className="rounded-lg border border-slate-300 p-3 font-medium">Download the template</button>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Choose your file
        <input type="file" accept=".xlsx,.csv" onChange={choose} className="rounded-lg border border-slate-300 bg-white p-3 text-base" />
      </label>

      {busy && <p className="text-slate-600">Working…</p>}
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}

      {check && (
        <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="font-semibold">{fileName}</p>
          <p className="text-sm">{check.ready.length} students are ready. {check.errors.length} problems found.</p>
          {check.errors.length > 0 ? (
            <>
              <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
                Nothing is imported until every problem is fixed. Correct the rows in your file and choose it again.
              </p>
              <ul className="flex flex-col gap-1 text-sm text-red-800">
                {check.errors.map((e, i) => <li key={i}>Row {e.line}: {e.message}</li>)}
              </ul>
            </>
          ) : (
            <button onClick={runImport} disabled={busy || check.ready.length === 0} className="rounded-lg bg-brand p-3 font-semibold text-white disabled:opacity-60">
              Import {check.ready.length} students
            </button>
          )}
        </section>
      )}
    </div>
  )
}

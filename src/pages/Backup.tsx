import writeXlsxFile from 'write-excel-file/browser'
import { useState } from 'react'
import { backupFileName, EXCEL_TABLES, fetchAll, JSON_TABLES, sheetFrom } from '../lib/backup'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

const today = () => new Date().toISOString().slice(0, 10)
const load = (table: string) => fetchAll((from, to) => supabase!.from(table).select('*').range(from, to))

export default function Backup() {
  const [busy, setBusy] = useState<'xlsx' | 'json' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function excel() {
    setBusy('xlsx'); setMsg(null)
    try {
      const sheets = []
      for (const t of EXCEL_TABLES) sheets.push({ data: sheetFrom(await load(t)), sheet: t.slice(0, 31) })
      await writeXlsxFile(sheets as never).toFile(backupFileName('xlsx', today()))
      setMsg({ ok: true, text: 'The Excel file has been downloaded. Keep it somewhere safe, away from this phone or computer.' })
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'The export failed') })
    }
    setBusy(null)
  }

  async function json() {
    setBusy('json'); setMsg(null)
    try {
      const data: Record<string, unknown> = { exported_on: today() }
      for (const t of JSON_TABLES) data[t] = await load(t)
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = backupFileName('json', today())
      a.click()
      URL.revokeObjectURL(a.href)
      setMsg({ ok: true, text: 'The full backup file has been downloaded. Keep it somewhere safe.' })
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'The backup failed') })
    }
    setBusy(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-brand">Backup and export</h1>
      <p className="text-sm text-slate-600">Download all the school's records. Do this at the end of every term and before the year-end promotion. Parent login codes are never included.</p>
      {msg && <p className={`rounded-xl p-4 text-sm ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-800'}`}>{msg.text}</p>}
      <button onClick={excel} disabled={busy !== null} className="rounded-lg bg-brand p-3 font-semibold text-white disabled:opacity-60">{busy === 'xlsx' ? 'Preparing…' : 'Download everything as Excel'}</button>
      <p className="-mt-2 text-xs text-slate-600">One sheet per kind of record: students, scores, attendance, fees, payments and more. Easy to open and read.</p>
      <button onClick={json} disabled={busy !== null} className="rounded-lg border border-slate-300 p-3 font-medium disabled:opacity-60">{busy === 'json' ? 'Preparing…' : 'Download the full backup file'}</button>
      <p className="-mt-2 text-xs text-slate-600">Everything above plus term snapshots and the change history. This is the complete copy for safekeeping.</p>
    </div>
  )
}

// Backup and full export (T29). Admin only. Reads every table page by page (the server returns at most 1000 rows
// per request) and turns them into Excel sheets or one JSON file. Parent codes are never exported (only hashes exist).
export const EXCEL_TABLES = [
  'students', 'student_movements', 'classes', 'subjects', 'class_subjects', 'grade_scale', 'academic_years', 'terms',
  'scores', 'report_remarks', 'results_publish', 'attendance_weeks', 'attendance_entries', 'staff', 'staff_attendance',
  'non_school_days', 'fee_items', 'payments', 'settings',
] as const
// Large or technical tables go in the JSON backup only.
export const JSON_ONLY_TABLES = ['term_snapshots', 'history'] as const
export const JSON_TABLES = [...EXCEL_TABLES, ...JSON_ONLY_TABLES] as const

export const PAGE = 1000

export async function fetchAll(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Record<string, unknown>[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

const cell = (v: unknown): string | number | boolean | undefined => {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 32000)
  return v as string | number | boolean
}

/** A header row followed by one row per record; columns are all keys seen, in first-seen order. */
export function sheetFrom(rows: Record<string, unknown>[]): { value?: string | number | boolean; fontWeight?: 'bold' }[][] {
  const cols: string[] = []
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k)
  if (cols.length === 0) return [[{ value: '(no records)' }]]
  return [cols.map((c) => ({ value: c, fontWeight: 'bold' as const })), ...rows.map((r) => cols.map((c) => ({ value: cell(r[c]) })))]
}

export const backupFileName = (kind: 'xlsx' | 'json', today: string) => `Alemiya-Academy-backup-${today}.${kind}`

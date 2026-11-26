// Timetable upload: what files are allowed and where they are stored.
export const MAX_BYTES = 10 * 1024 * 1024
export const ALLOWED: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'picture',
  'image/png': 'picture',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word file',
}
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx'

export type FileCheck = { ok: true } | { ok: false; error: string }

export function checkTimetableFile(file: { name: string; type: string; size: number }): FileCheck {
  if (file.size <= 0) return { ok: false, error: 'This file is empty.' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'The file is too big. The most allowed is 10 MB. Try a smaller PDF or picture.' }
  if (!ALLOWED[file.type]) return { ok: false, error: 'Use a PDF, a picture (JPG or PNG) or a Word file.' }
  return { ok: true }
}

/** Letters, numbers, dots and dashes only, so any file name is safe to store. */
export function safeFileName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
  return (cleaned || 'timetable').slice(-80)
}

export const storagePath = (termId: string, name: string, now: number = Date.now()) => `${termId}/${now}-${safeFileName(name)}`

export const isImage = (contentType: string | null) => contentType === 'image/jpeg' || contentType === 'image/png'
export const fileKind = (contentType: string | null) => (contentType && ALLOWED[contentType]) || 'file'
export const sizeLabel = (bytes: number | null) => (bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

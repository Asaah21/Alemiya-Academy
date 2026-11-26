// Checks for the staff list (Setup, Staff). This is the list of people who work at the school;
// it is separate from login accounts (Setup, Users).
import { checkName, checkOptionalPhone } from './validation'
export type Check = { ok: true } | { ok: false; error: string }

export type StaffInput = { full_name: string; phone: string; subject_notes: string; class_id: string }

export function validateStaff(s: StaffInput): Check {
  const n = checkName(s.full_name, 'full name')
  if (!n.ok) return { ok: false, error: n.error }
  const p = checkOptionalPhone(s.phone)
  if (!p.ok) return { ok: false, error: p.error }
  return { ok: true }
}

export function filterStaff<T extends { full_name: string; phone: string | null; subject_notes: string | null; status: string }>(
  list: T[],
  opts: { search: string; status: string },
): T[] {
  const q = opts.search.trim().toLowerCase()
  return list.filter((s) => {
    if (opts.status && s.status !== opts.status) return false
    if (!q) return true
    return [s.full_name, s.phone ?? '', s.subject_notes ?? ''].some((v) => v.toLowerCase().includes(q))
  })
}

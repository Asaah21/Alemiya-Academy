// Checks for the staff list (Setup, Staff). This is the list of people who work at the school;
// it is separate from login accounts (Setup, Users).
export type Check = { ok: true } | { ok: false; error: string }

export type StaffInput = { full_name: string; phone: string; subject_notes: string; class_id: string }

export function validateStaff(s: StaffInput): Check {
  if (s.full_name.trim().length < 2) return { ok: false, error: 'Enter the full name.' }
  if (s.phone.trim() && !/^[0-9+\s()-]{7,20}$/.test(s.phone.trim())) {
    return { ok: false, error: 'The phone number looks wrong. Use digits only, for example 0241234567.' }
  }
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

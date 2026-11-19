// Checks and search for the Students screens.
export type Check = { ok: true } | { ok: false; error: string }
const fail = (error: string): Check => ({ ok: false, error })

export type StudentInput = {
  full_name: string
  gender: string
  date_of_birth: string
  class_id: string
  guardian_name: string
  guardian_phone: string
  admitted_on: string
}

export function validateStudent(s: StudentInput, today = new Date().toISOString().slice(0, 10)): Check {
  if (s.full_name.trim().length < 2) return fail('Enter the student’s full name.')
  if (s.gender !== 'male' && s.gender !== 'female') return fail('Choose Male or Female.')
  if (!s.class_id) return fail('Choose the class.')
  if (s.date_of_birth && s.date_of_birth >= today) return fail('The date of birth must be in the past.')
  if (s.guardian_phone && !/^[0-9+\s()-]{7,20}$/.test(s.guardian_phone.trim())) {
    return fail('The guardian phone number looks wrong. Use digits only, for example 0241234567.')
  }
  return { ok: true }
}

export type ListedStudent = { admission_no: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; class_id: string | null; status: string }

// Matches name, admission number or guardian name / phone; optional class and status filters.
export function filterStudents<T extends ListedStudent>(
  list: T[],
  opts: { search: string; classId: string; status: string },
): T[] {
  const q = opts.search.trim().toLowerCase()
  return list.filter((s) => {
    if (opts.classId && s.class_id !== opts.classId) return false
    if (opts.status && s.status !== opts.status) return false
    if (!q) return true
    return [s.full_name, s.admission_no, s.guardian_name ?? '', s.guardian_phone ?? ''].some((v) => v.toLowerCase().includes(q))
  })
}

export const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  transferred_out: 'Transferred out',
  withdrawn: 'Withdrawn',
  graduated: 'Graduated',
}

export const MOVEMENT_LABELS: Record<string, string> = {
  new: 'New admission',
  transfer_in: 'Transferred in',
  transfer_out: 'Transferred out',
  withdrawn: 'Withdrawn',
  graduated: 'Graduated',
  promoted: 'Promoted',
  repeated: 'Repeated the class',
}

// Checks the "move out / bring back" form before it is sent. The database checks again.
export function validateMovement(
  m: { movement: string; moved_on: string; reason: string },
  today = new Date().toISOString().slice(0, 10),
): Check {
  if (!m.movement) return fail('Choose what happened.')
  if (!m.moved_on) return fail('Choose the date.')
  if (m.moved_on > today) return fail('The date cannot be in the future.')
  if (m.movement !== 'graduated' && m.reason.trim() === '') return fail('Give a reason.')
  return { ok: true }
}

// How many active students are in each class (the class roll).
export function classRoll(students: { class_id: string | null; status: string }[]): Map<string, number> {
  const roll = new Map<string, number>()
  for (const s of students) if (s.status === 'active' && s.class_id) roll.set(s.class_id, (roll.get(s.class_id) ?? 0) + 1)
  return roll
}

// Reading and checking a file of students (T08). Nothing here touches the database.
export const TEMPLATE_HEADERS = ['Full name', 'Gender', 'Date of birth', 'Class', 'Guardian name', 'Guardian phone', 'Admission number'] as const
export const MAX_ROWS = 500

export const TEMPLATE_CSV =
  TEMPLATE_HEADERS.join(',') + '\r\n' +
  'Ama Mensah,Female,2015-03-21,Basic 3,Kofi Mensah,0241234567,\r\n' +
  'Kwesi Boateng,Male,2013-11-02,Basic 5,Akua Boateng,0551234567,\r\n'

export type Rec = {
  full_name: string; gender: string; date_of_birth: string; class_name: string
  guardian_name: string; guardian_phone: string; admission_no: string
}

// Small CSV reader that understands quotes, commas inside quotes and a leading byte-order mark.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const HEADER_NAMES: { [key in keyof Rec]: string[] } = {
  full_name: ['fullname', 'name', 'studentname'],
  gender: ['gender', 'sex'],
  date_of_birth: ['dateofbirth', 'dob', 'birthdate'],
  class_name: ['class', 'classname'],
  guardian_name: ['guardianname', 'guardian', 'parentname', 'parent'],
  guardian_phone: ['guardianphone', 'phone', 'parentphone', 'guardiannumber'],
  admission_no: ['admissionnumber', 'admissionno', 'admission'],
}
const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

export type Parsed = { records: { line: number; rec: Rec }[]; errors: { line: number; message: string }[] }

// Turns rows of text (first row = headings) into records, whatever order the columns are in.
export function toRecords(rows: string[][]): Parsed {
  const out: Parsed = { records: [], errors: [] }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) { out.errors.push({ line: 1, message: 'The file is empty.' }); return out }
  const heads = nonEmpty[0].map(squash)
  const col = {} as { [k in keyof Rec]: number }
  for (const key of Object.keys(HEADER_NAMES) as (keyof Rec)[]) col[key] = heads.findIndex((h) => HEADER_NAMES[key].includes(h))
  const missing = (['full_name', 'gender', 'class_name'] as const).filter((k) => col[k] < 0)
  if (missing.length) {
    const label = { full_name: 'Full name', gender: 'Gender', class_name: 'Class' }
    out.errors.push({ line: 1, message: `The first row must have the headings: ${missing.map((m) => label[m]).join(', ')}. Use the template.` })
    return out
  }
  if (nonEmpty.length - 1 > MAX_ROWS) {
    out.errors.push({ line: 1, message: `A file can have at most ${MAX_ROWS} students. Split it into smaller files.` })
    return out
  }
  nonEmpty.slice(1).forEach((r, i) => {
    const get = (k: keyof Rec) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '')
    out.records.push({
      line: i + 2,
      rec: {
        full_name: get('full_name'), gender: get('gender'), date_of_birth: get('date_of_birth'), class_name: get('class_name'),
        guardian_name: get('guardian_name'), guardian_phone: get('guardian_phone'), admission_no: get('admission_no'),
      },
    })
  })
  return out
}

export function parseGender(v: string): 'male' | 'female' | null {
  const g = v.trim().toLowerCase()
  if (['male', 'm', 'boy'].includes(g)) return 'male'
  if (['female', 'f', 'girl'].includes(g)) return 'female'
  return null
}

// Accepts 2015-03-21, 21/03/2015 and 21-03-2015. Returns '' for blank, null for something unreadable.
export function parseDate(v: string): string | '' | null {
  const s = v.trim()
  if (!s) return ''
  let y: number, m: number, d: number
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (match) { y = +match[1]; m = +match[2]; d = +match[3] }
  else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) { d = +match[1]; m = +match[2]; y = +match[3] }
  else return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Excel drops the leading zero from phone numbers, so 241234567 becomes 0241234567.
export function fixPhone(v: string): string {
  const s = v.trim()
  return /^[1-9]\d{8}$/.test(s) ? '0' + s : s
}

export type ReadyStudent = {
  full_name: string; gender: 'male' | 'female'; date_of_birth: string | null; class_id: string
  guardian_name: string | null; guardian_phone: string | null; admission_no?: string
}
export type ImportCheck = { ready: ReadyStudent[]; errors: { line: number; message: string }[] }

export function checkImport(
  parsed: Parsed,
  classes: { id: string; name: string }[],
  existing: { admission_no: string; full_name: string; date_of_birth: string | null }[],
  today = new Date().toISOString().slice(0, 10),
): ImportCheck {
  const errors = [...parsed.errors]
  const ready: ReadyStudent[] = []
  const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '')
  const classByKey = new Map(classes.map((c) => [key(c.name), c.id]))
  const seenNo = new Set(existing.map((e) => e.admission_no.toLowerCase()))
  const seenPerson = new Set(existing.map((e) => `${e.full_name.trim().toLowerCase()}|${e.date_of_birth ?? ''}`))

  for (const { line, rec } of parsed.records) {
    const problems: string[] = []
    const name = rec.full_name.replace(/\s+/g, ' ')
    if (name.length < 2) problems.push('Full name is missing.')
    const gender = parseGender(rec.gender)
    if (!gender) problems.push('Gender must be Male or Female.')
    const classId = classByKey.get(key(rec.class_name))
    if (!classId) problems.push(rec.class_name ? `Class "${rec.class_name}" does not exist.` : 'Class is missing.')
    const dob = parseDate(rec.date_of_birth)
    if (dob === null) problems.push('Date of birth is not readable. Use 2015-03-21 or 21/03/2015.')
    else if (dob && dob >= today) problems.push('Date of birth must be in the past.')
    const phone = fixPhone(rec.guardian_phone)
    if (phone && !/^[0-9+\s()-]{7,20}$/.test(phone)) problems.push('Guardian phone looks wrong.')
    const no = rec.admission_no.trim()
    if (no) {
      if (seenNo.has(no.toLowerCase())) problems.push(`Admission number ${no} is already used.`)
      else seenNo.add(no.toLowerCase())
    }
    const person = `${name.toLowerCase()}|${dob || ''}`
    if (name.length >= 2 && dob && seenPerson.has(person)) problems.push('This student (same name and date of birth) already exists or is repeated in the file.')
    else if (name.length >= 2 && dob) seenPerson.add(person)

    if (problems.length) errors.push({ line, message: `${name || 'Row'}: ${problems.join(' ')}` })
    else {
      ready.push({
        full_name: name, gender: gender!, date_of_birth: dob || null, class_id: classId!,
        guardian_name: rec.guardian_name || null, guardian_phone: phone || null,
        ...(no ? { admission_no: no } : {}),
      })
    }
  }
  return { ready, errors }
}

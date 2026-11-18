// Checks for academic years and terms (used by the Setup screens).
export type Check = { ok: true } | { ok: false; error: string }
const fail = (error: string): Check => ({ ok: false, error })

export function validateYear(y: { name: string; start_date: string; end_date: string }): Check {
  if (!/^\d{4}\/\d{4}$/.test(y.name.trim())) return fail('Write the year like 2026/2027.')
  const [a, b] = y.name.trim().split('/').map(Number)
  if (b !== a + 1) return fail('The second year must follow the first, for example 2026/2027.')
  if (!y.start_date || !y.end_date) return fail('Choose the start and end dates.')
  if (y.end_date <= y.start_date) return fail('The end date must be after the start date.')
  return { ok: true }
}

export type TermLike = { id?: string; name: string; start_date: string; end_date: string }

// A term must sit inside its academic year and not overlap another term in that year.
export function validateTerm(
  t: TermLike,
  year: { start_date: string; end_date: string },
  others: TermLike[],
): Check {
  if (!['Term 1', 'Term 2', 'Term 3'].includes(t.name)) return fail('Choose Term 1, Term 2 or Term 3.')
  if (!t.start_date || !t.end_date) return fail('Choose the start and end dates.')
  if (t.end_date <= t.start_date) return fail('The end date must be after the start date.')
  if (t.start_date < year.start_date || t.end_date > year.end_date) {
    return fail('The term must fall inside the academic year dates.')
  }
  for (const o of others) {
    if (o.id && o.id === t.id) continue
    if (o.name === t.name) return fail(`${t.name} already exists in this year.`)
    if (t.start_date <= o.end_date && o.start_date <= t.end_date) {
      return fail(`These dates overlap ${o.name}.`)
    }
  }
  return { ok: true }
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

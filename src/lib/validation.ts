// Shared checks for names, phone numbers and email addresses, so every form follows the same rules.
// Error messages are written for a non-technical reader.
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

const NAME_CHARS = /^[\p{L}][\p{L}\p{M}\s.'’-]*$/u

/** A person's name: at least 3 letters, only letters, spaces and . ' - marks. */
export function checkName(raw: string, what = 'name'): Checked<string> {
  const v = raw.trim().replace(/\s+/g, ' ')
  const letters = (v.match(/\p{L}/gu) ?? []).length
  if (!v) return { ok: false, error: `Please enter the ${what}.` }
  if (letters < 3) return { ok: false, error: `The ${what} must have at least 3 letters.` }
  if (!NAME_CHARS.test(v)) return { ok: false, error: `The ${what} can only have letters and spaces. Remove any numbers or symbols.` }
  if (v.length > 80) return { ok: false, error: `The ${what} is too long.` }
  return { ok: true, value: v }
}

/**
 * A Ghana phone number: 10 digits starting with 0 (for example 0241234567).
 * Spaces and dashes are ignored, and +233 or 233 at the start is turned into 0.
 */
export function checkPhone(raw: string, what = 'phone number'): Checked<string> {
  let v = raw.replace(/[\s\-().]/g, '')
  if (v.startsWith('+233')) v = '0' + v.slice(4)
  else if (v.startsWith('233') && v.length === 12) v = '0' + v.slice(3)
  if (!/^\d+$/.test(v)) return { ok: false, error: `The ${what} can only have numbers, for example 0241234567.` }
  if (v.length !== 10) return { ok: false, error: `The ${what} must have exactly 10 digits, for example 0241234567. You typed ${v.length}.` }
  if (!v.startsWith('0')) return { ok: false, error: `The ${what} must start with 0, for example 0241234567.` }
  return { ok: true, value: v }
}

/** Optional phone: blank is fine, otherwise it must be a valid number. */
export function checkOptionalPhone(raw: string, what?: string): Checked<string | null> {
  if (!raw.trim()) return { ok: true, value: null }
  const c = checkPhone(raw, what)
  return c.ok ? { ok: true, value: c.value } : c
}

export function checkEmail(raw: string): Checked<string> {
  const v = raw.trim().toLowerCase()
  if (!v) return { ok: false, error: 'Please enter the email address.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { ok: false, error: 'This email address does not look right. It should look like name@example.com.' }
  return { ok: true, value: v }
}

/** A date of birth for a school pupil: in the past, and not more than 25 years ago. */
export function checkBirthDate(raw: string, today = new Date().toISOString().slice(0, 10)): Checked<string | null> {
  if (!raw) return { ok: true, value: null }
  if (raw >= today) return { ok: false, error: 'The date of birth must be a day in the past.' }
  const oldest = `${Number(today.slice(0, 4)) - 25}${today.slice(4)}`
  if (raw < oldest) return { ok: false, error: 'This date of birth is too long ago for a school pupil. Please check the year.' }
  return { ok: true, value: raw }
}

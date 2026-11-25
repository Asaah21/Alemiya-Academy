// Turns technical errors into short messages a teacher can act on.
// Messages we raise ourselves in the database (plain sentences such as "Close every term of this year first")
// are shown as they are. Everything technical is replaced.
type Err = { message?: string; code?: string } | null | undefined | unknown

const TECHNICAL = /(violates|constraint|relation "|column "|syntax|function public\.|permission denied|schema|duplicate key|null value|invalid input|uuid|pgrst|jwt|postgres|stack|undefined|\[object)/i

export function friendlyError(err: Err, fallback = 'Something went wrong. Please try again.'): string {
  const e = (typeof err === 'object' && err !== null ? err : {}) as { message?: string; code?: string }
  const msg = (e.message ?? (typeof err === 'string' ? err : '')).trim()
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|timed out/i.test(msg)) {
    return 'No internet connection. Check your data or Wi-Fi and try again. Nothing was lost.'
  }
  if (/jwt expired|not authenticated|invalid jwt|refresh token/i.test(msg)) return 'Your sign-in has ended. Please sign in again.'
  if (/row-level security|permission denied|not allowed|only the admin/i.test(msg) && !/^only the admin/i.test(msg)) return 'You are not allowed to do this.'
  if (e.code === '23505' || /duplicate key/i.test(msg)) return 'This already exists.'
  if (e.code === '23503') return 'This is still used by other records, so it cannot be changed.'
  if (!msg || TECHNICAL.test(msg) || msg.length > 200) return fallback
  return msg
}

/** Message after a save that worked, so every save says the same kind of thing. */
export const saved = (what: string) => `${what} saved.`

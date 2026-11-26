// Notices: checks before saving and the date shown on each notice.
export const TITLE_MAX = 120
export const BODY_MAX = 2000

export type NoticeInput = { title: string; body: string; forParents: boolean }
export type NoticeCheck = { ok: true; value: { title: string; body: string; audience: 'staff' | 'staff_and_parents' } } | { ok: false; error: string }

export function checkNotice(n: NoticeInput): NoticeCheck {
  const title = n.title.trim()
  const body = n.body.trim()
  if (!title) return { ok: false, error: 'Enter a title.' }
  if (title.length > TITLE_MAX) return { ok: false, error: `The title must be ${TITLE_MAX} characters or fewer.` }
  if (!body) return { ok: false, error: 'Write the message.' }
  if (body.length > BODY_MAX) return { ok: false, error: `The message must be ${BODY_MAX} characters or fewer.` }
  return { ok: true, value: { title, body, audience: n.forParents ? 'staff_and_parents' : 'staff' } }
}

/** "Today", "Yesterday", or a date such as 21 Nov 2026. */
export function noticeDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Home screen helpers (T28): small to-do and number summaries.
export type HomeClass = { id: string; name: string }

/** Classes that have no attendance recorded yet for the week. */
export function classesMissingAttendance(classes: HomeClass[], recordedClassIds: string[]): HomeClass[] {
  const done = new Set(recordedClassIds)
  return classes.filter((c) => !done.has(c.id))
}

/** Total of valid payments, rounded to pesewas. */
export function cashTotal(payments: { amount: number | string; status: string }[]): number {
  const t = payments.filter((p) => p.status === 'valid').reduce((s, p) => s + Number(p.amount), 0)
  return Math.round(t * 100) / 100
}

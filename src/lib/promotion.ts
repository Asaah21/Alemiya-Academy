// Year-end promotion helpers (rule S7). The database does the real work; this only previews it.
export type PromoClass = { id: string; name: string; level_order: number }
export type PromoStudent = { id: string; class_id: string }

/** For each class id, the next class by level order (null = last class, students graduate). */
export function nextClassMap(classes: PromoClass[]): Record<string, PromoClass | null> {
  const sorted = [...classes].sort((a, b) => a.level_order - b.level_order)
  const out: Record<string, PromoClass | null> = {}
  sorted.forEach((c, i) => { out[c.id] = sorted[i + 1] ?? null })
  return out
}

export function planPromotion(classes: PromoClass[], students: PromoStudent[], repeaters: Set<string>) {
  const next = nextClassMap(classes)
  let promoted = 0, repeated = 0, graduated = 0
  for (const s of students) {
    if (repeaters.has(s.id)) repeated++
    else if (next[s.class_id] === null) graduated++
    else promoted++
  }
  return { promoted, repeated, graduated }
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The day after the last term ends, but never later than today. */
export function defaultPromotionDate(lastTermEnd: string, today: string): string {
  const d = addDays(lastTermEnd, 1)
  return d > today ? today : d
}

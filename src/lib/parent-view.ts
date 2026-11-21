// Turns what the database gives a parent (parent_report) into a report card. No database calls here.
import type { GradeRow } from './grades'
import { buildClassCards, type CardData } from './report-card'
import type { ScoreRow } from './results'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export type ParentReport = {
  school: { name: string | null; location: string | null; district: string | null; region: string | null; circuit: string | null; logo_url: string | null; next_term_opening_date: string | null; class_score_max: number | string; exam_score_max: number | string }
  student: { id: string; full_name: string; admission_no: string }
  class_name: string
  term_name: string
  year_name: string
  scored: boolean
  scale: { min_score: number | string; max_score: number | string; grade: string; remark: string | null }[]
  subjects: { id: string; name: string }[]
  scores: { student_id: string; subject_id: string; class_score: number | string | null; exam_score: number | string | null; is_absent: boolean }[]
  remark: { teacher_remark: string | null; head_remark: string | null } | null
  attendance: { school_days: number | string; days_absent: number | string } | null
  class_totals: (number | string)[]
  class_size: number
}

// Competition ranking (ties share a place: 1, 2, 2, 4), only when every student in the class has a total (rule G4, G7).
export function positionFrom(own: number, totals: number[]): number {
  return 1 + totals.filter((t) => t > own).length
}

export function cardFromParentReport(r: ParentReport): CardData {
  const scale: GradeRow[] = r.scale.map((g) => ({ ...g, min_score: Number(g.min_score), max_score: Number(g.max_score), remark: g.remark ?? '' })) as GradeRow[]
  const scores: ScoreRow[] = r.scores.map((s) => ({ ...s, class_score: num(s.class_score), exam_score: num(s.exam_score) }))
  const built = buildClassCards({
    school: {
      name: r.school.name ?? '', location: r.school.location ?? '', district: r.school.district ?? '', region: r.school.region ?? '', circuit: r.school.circuit ?? '',
      logoUrl: r.school.logo_url, nextTermOpening: r.school.next_term_opening_date, classMax: Number(r.school.class_score_max), examMax: Number(r.school.exam_score_max),
    },
    className: r.class_name, termName: r.term_name, yearName: r.year_name, scored: r.scored, scale,
    students: [{ id: r.student.id, full_name: r.student.full_name, admission_no: r.student.admission_no }],
    subjects: r.subjects, scores,
    remarks: r.remark ? [{ student_id: r.student.id, teacher_remark: r.remark.teacher_remark, head_remark: r.remark.head_remark }] : [],
    attendance: r.attendance ? [{ student_id: r.student.id, school_days: Number(r.attendance.school_days), days_absent: Number(r.attendance.days_absent) }] : [],
  })
  const card = built.cards[0]
  const totals = r.class_totals.map(Number)
  return {
    ...card,
    classSize: r.class_size,
    position: r.scored && card.overall !== null && totals.length === r.class_size ? positionFrom(card.overall, totals) : null,
  }
}

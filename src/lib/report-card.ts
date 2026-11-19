// Builds report card data for a whole class (rules C1, G3, G4, G5, G7, G8). No database calls here.
import type { GradeRow } from './grades'
import { computeClassResults, gradeFor, isComplete, subjectTotal, type MissingItem, type ScoreRow } from './results'

export type SchoolInfo = {
  name: string; location: string; district: string; region: string; circuit: string
  logoUrl: string | null; nextTermOpening: string | null; classMax: number; examMax: number
}
export type CardSubject = { name: string; classScore: number | null; examScore: number | null; absent: boolean; total: number | null; grade: string; remark: string }
export type CardData = {
  school: SchoolInfo
  studentId: string
  studentName: string
  admissionNo: string
  className: string
  termName: string
  yearName: string
  scored: boolean // false = remarks only (rule G8)
  showGrades: boolean // false when no grading scale is set (rule G3)
  subjects: CardSubject[]
  overall: number | null
  average: number | null
  position: number | null
  classSize: number
  attendance: { present: number; schoolDays: number } | null
  teacherRemark: string
  headRemark: string
}

export type ClassCardsInput = {
  school: SchoolInfo
  className: string
  termName: string
  yearName: string
  scored: boolean
  scale: GradeRow[]
  students: { id: string; full_name: string; admission_no: string }[]
  subjects: { id: string; name: string }[]
  scores: ScoreRow[]
  remarks: { student_id: string; teacher_remark: string | null; head_remark: string | null }[]
  attendance: { student_id: string; school_days: number; days_absent: number }[]
}

export type ClassCards = { cards: CardData[]; ready: boolean; missing: MissingItem[] }

// Rule G7: cards for a scored class are produced only when every student has every subject.
// A remarks-only class (rule G8) needs no scores.
export function buildClassCards(inp: ClassCardsInput): ClassCards {
  const results = computeClassResults(inp.students, inp.subjects, inp.scores)
  const ready = inp.scored ? results.complete : inp.students.length > 0
  const scoreBy = new Map(inp.scores.map((s) => [`${s.student_id}|${s.subject_id}`, s]))
  const remarkBy = new Map(inp.remarks.map((r) => [r.student_id, r]))
  const attBy = new Map(inp.attendance.map((a) => [a.student_id, a]))
  const resultBy = new Map(results.rows.map((r) => [r.studentId, r]))

  const cards: CardData[] = inp.students.map((st) => {
    const res = resultBy.get(st.id)!
    const subjects: CardSubject[] = inp.scored
      ? inp.subjects.map((sub) => {
          const s = scoreBy.get(`${st.id}|${sub.id}`)
          const c = s?.class_score ?? null
          const x = s?.exam_score ?? null
          const absent = s?.is_absent ?? false
          const total = isComplete(c, x, absent) ? subjectTotal(c, x, absent) : null
          const g = inp.scale.length ? gradeFor(total, inp.scale) : null
          return { name: sub.name, classScore: c, examScore: x, absent, total, grade: g?.grade ?? '', remark: g?.remark ?? '' }
        })
      : []
    const att = attBy.get(st.id)
    const r = remarkBy.get(st.id)
    return {
      school: inp.school,
      studentId: st.id,
      studentName: st.full_name,
      admissionNo: st.admission_no,
      className: inp.className,
      termName: inp.termName,
      yearName: inp.yearName,
      scored: inp.scored,
      showGrades: inp.scale.length > 0,
      subjects,
      overall: inp.scored ? res.overall : null,
      average: inp.scored ? res.average : null,
      position: inp.scored ? res.position : null,
      classSize: inp.students.length,
      attendance: att && att.school_days > 0 ? { present: att.school_days - att.days_absent, schoolDays: att.school_days } : null,
      teacherRemark: r?.teacher_remark ?? '',
      headRemark: r?.head_remark ?? '',
    }
  })
  return { cards, ready, missing: inp.scored ? results.missing : [] }
}

export function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

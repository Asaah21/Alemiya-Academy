import type { GradeRow } from '../../lib/grades'
import { buildClassCards, type ClassCards } from '../../lib/report-card'
import type { ScoreRow } from '../../lib/results'
import { supabase } from '../../lib/supabase'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// Loads everything a class's report cards need and builds them. Throws on a database error.
export async function loadClassCards(classId: string, termId: string): Promise<ClassCards> {
  const db = supabase!
  const [settings, cls, term, scaleRes, studentsRes, csRes] = await Promise.all([
    db.from('settings').select('*').maybeSingle(),
    db.from('classes').select('name, scored').eq('id', classId).single(),
    db.from('terms').select('name, academic_years(name)').eq('id', termId).single(),
    db.from('grade_scale').select('min_score, max_score, grade, remark'),
    db.from('students').select('id, full_name, admission_no').eq('class_id', classId).eq('status', 'active').order('full_name'),
    db.from('class_subjects').select('subjects(id, name)').eq('class_id', classId),
  ])
  for (const r of [cls, term, scaleRes, studentsRes, csRes]) if (r.error) throw r.error

  const students = studentsRes.data ?? []
  const ids = students.map((s) => s.id)
  const [scoresRes, remarksRes, attRes] = ids.length
    ? await Promise.all([
        db.from('scores').select('student_id, subject_id, class_score, exam_score, is_absent').eq('term_id', termId).in('student_id', ids),
        db.from('report_remarks').select('student_id, teacher_remark, head_remark').eq('term_id', termId).in('student_id', ids),
        db.rpc('attendance_term_totals', { p_term: termId }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
  for (const r of [scoresRes, remarksRes, attRes]) if (r.error) throw r.error

  const subjects = ((csRes.data ?? []) as unknown as { subjects: { id: string; name: string } | { id: string; name: string }[] }[])
    .map((r) => (Array.isArray(r.subjects) ? r.subjects[0] : r.subjects))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
  const idSet = new Set(ids)
  const st = settings.data
  const year = term.data!.academic_years as { name: string } | { name: string }[] | null

  return buildClassCards({
    school: {
      name: st?.school_name ?? '', location: st?.location ?? '', district: st?.district ?? '', region: st?.region ?? '', circuit: st?.circuit ?? '',
      logoUrl: st?.logo_url ?? null, nextTermOpening: st?.next_term_opening_date ?? null,
      classMax: Number(st?.class_score_max ?? 30), examMax: Number(st?.exam_score_max ?? 100),
    },
    className: cls.data!.name,
    termName: term.data!.name,
    yearName: (Array.isArray(year) ? year[0]?.name : year?.name) ?? '',
    scored: cls.data!.scored,
    scale: ((scaleRes.data ?? []) as GradeRow[]).map((r) => ({ ...r, min_score: Number(r.min_score), max_score: Number(r.max_score), remark: r.remark ?? '' })),
    students,
    subjects,
    scores: ((scoresRes.data ?? []) as ScoreRow[]).map((r) => ({ ...r, class_score: num(r.class_score), exam_score: num(r.exam_score) })),
    remarks: remarksRes.data ?? [],
    attendance: ((attRes.data ?? []) as { student_id: string; school_days: number | string; days_absent: number | string }[])
      .filter((a) => idSet.has(a.student_id))
      .map((a) => ({ student_id: a.student_id, school_days: Number(a.school_days), days_absent: Number(a.days_absent) })),
  })
}

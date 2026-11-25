// Numbers for the Students page: totals, boys and girls, and attendance per class.
import { classRate, schoolRate, type Rate, type Totals } from './attendance'

export type StatStudent = { class_id: string | null; gender: string | null }
export type StatClass = { id: string; name: string }
export type ClassStat = { id: string; name: string; total: number; boys: number; girls: number; attendance: Rate }
export type StudentStats = { total: number; boys: number; girls: number; classes: ClassStat[]; attendance: Rate }

export function studentStats(students: StatStudent[], classes: StatClass[], totals: Totals[]): StudentStats {
  const rows: ClassStat[] = classes.map((c) => {
    const mine = students.filter((s) => s.class_id === c.id)
    return {
      id: c.id, name: c.name, total: mine.length,
      boys: mine.filter((s) => s.gender === 'male').length,
      girls: mine.filter((s) => s.gender === 'female').length,
      attendance: classRate(totals, c.id),
    }
  })
  return {
    total: students.length,
    boys: students.filter((s) => s.gender === 'male').length,
    girls: students.filter((s) => s.gender === 'female').length,
    classes: rows,
    attendance: schoolRate(totals),
  }
}

import { BarChart3, Banknote, ClipboardCheck, Settings, UserCog, Users, type LucideIcon } from 'lucide-react'
import type { UserRole } from '../../lib/users'

export type NavLink = { label: string; path: string; roles: UserRole[] }
export type Section = { id: string; label: string; path: string; roles: UserRole[]; hint: string; icon: LucideIcon; links: NavLink[] }
export type Group = { title: string; sections: Section[] }

const both: UserRole[] = ['admin', 'staff']
const admin: UserRole[] = ['admin']

// The whole menu in one place. A section is a tile on Home and in the side menu; its links are on its own page.
// Add a screen: add a line to a section's links and a <Route> in App.tsx.
export const GROUPS: Group[] = [
  {
    title: 'Academics',
    sections: [
      {
        icon: Users, id: 'students', label: 'Students', path: '/hub/students', roles: both, hint: 'List, add, attendance',
        links: [
          { label: 'Add a new student', path: '/students/new', roles: both },
          { label: 'Student list', path: '/students', roles: both },
          { label: 'Import students from Excel', path: '/students/import', roles: admin },
          { label: 'Weekly attendance', path: '/attendance', roles: both },
          { label: 'Attendance summary', path: '/attendance/summary', roles: both },
        ],
      },
      {
        icon: UserCog, id: 'staff', label: 'Staff', path: '/hub/staff', roles: admin, hint: 'Add staff, daily attendance',
        links: [
          { label: 'Staff list and add new', path: '/setup/staff', roles: admin },
          { label: 'Staff attendance', path: '/staff-attendance', roles: admin },
          { label: 'Staff attendance summary', path: '/staff-attendance/summary', roles: admin },
        ],
      },
      {
        icon: ClipboardCheck, id: 'exams', label: 'Exams', path: '/hub/exams', roles: both, hint: 'Scores, remarks, report cards',
        links: [
          { label: 'Enter scores', path: '/scores', roles: both },
          { label: 'Remarks', path: '/remarks', roles: both },
          { label: 'Class results and positions', path: '/scores/results', roles: both },
          { label: 'Report cards', path: '/report-cards', roles: both },
        ],
      },
    ],
  },
  {
    title: 'Administration',
    sections: [
      {
        icon: Banknote, id: 'fees', label: 'Fees', path: '/hub/fees', roles: both, hint: 'Payments, balances, cash',
        links: [
          { label: 'Record a payment', path: '/fees', roles: both },
          { label: 'Fee balances: owed by each student or class', path: '/fees/balances', roles: both },
          { label: 'Daily cash', path: '/fees/cash', roles: admin },
          { label: 'Add or change fees for each class', path: '/setup/fees', roles: admin },
        ],
      },
      { icon: BarChart3, id: 'reports', label: 'Reports', path: '/reports', roles: admin, hint: 'Summaries and Excel', links: [] },
      { icon: Settings, id: 'setup', label: 'Set up', path: '/setup', roles: admin, hint: 'Term, school info, users', links: [] },
    ],
  },
]

export const sectionsFor = (role: UserRole): Group[] =>
  GROUPS.map((g) => ({ ...g, sections: g.sections.filter((s) => s.roles.includes(role)) })).filter((g) => g.sections.length > 0)

export const linksFor = (section: Section, role: UserRole): NavLink[] => section.links.filter((l) => l.roles.includes(role))

export const findSection = (id: string): Section | undefined => GROUPS.flatMap((g) => g.sections).find((s) => s.id === id)

/** The section a page belongs to, so the side menu can highlight it. */
export function sectionIdFor(pathname: string): string | null {
  for (const s of GROUPS.flatMap((g) => g.sections)) {
    if (pathname === s.path || pathname.startsWith(s.path + '/')) return s.id
    if (s.links.some((l) => pathname === l.path || pathname.startsWith(l.path + '/'))) return s.id
  }
  if (pathname.startsWith('/setup')) return 'setup'
  return null
}

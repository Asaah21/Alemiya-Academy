import type { UserRole } from '../../lib/users'

export type MenuItem = {
  label: string
  path: string
  roles: UserRole[] // who sees this item
  step: string // build step that fills the screen in
}

// One line per screen in the menu. Add a screen: add a line here and a <Route> in App.tsx.
export const MENU: MenuItem[] = [
  { label: 'Home', path: '/', roles: ['admin', 'staff'], step: '' },
  { label: 'Students', path: '/students', roles: ['admin', 'staff'], step: 'T05' },
  { label: 'Weekly Attendance', path: '/attendance', roles: ['admin', 'staff'], step: 'T11' },
  { label: 'Staff Attendance', path: '/staff-attendance', roles: ['admin'], step: 'T34' },
  { label: 'Enter Scores', path: '/scores', roles: ['admin', 'staff'], step: 'T15' },
  { label: 'Remarks', path: '/remarks', roles: ['admin', 'staff'], step: 'T14' },
  { label: 'Report Cards', path: '/report-cards', roles: ['admin', 'staff'], step: 'T20' },
  { label: 'Fees', path: '/fees', roles: ['admin', 'staff'], step: 'T24' },
  { label: 'Reports', path: '/reports', roles: ['admin'], step: 'T24' },
  { label: 'Setup', path: '/setup', roles: ['admin'], step: 'T06' },
]

export function menuFor(role: UserRole): MenuItem[] {
  return MENU.filter((m) => m.roles.includes(role))
}

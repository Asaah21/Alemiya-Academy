import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, GraduationCap, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { useSchool } from '../features/school/SchoolProvider'
import { sectionIdFor, sectionsFor } from '../features/nav/menu'
import ErrorBoundary from './ErrorBoundary'
import TermBadge from './TermBadge'

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

// Frame for every logged-in screen: dark side menu, a slim top bar, and a wide content area.
export default function Layout({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth()
  const { schoolName, currentTerm } = useSchool()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (state.status !== 'ready') return null
  const { profile } = state
  const groups = sectionsFor(profile.role)
  const current = sectionIdFor(pathname)
  const close = () => setOpen(false)

  const item = 'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors'
  const on = 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-accent)]'
  const off = 'text-teal-100/80 hover:bg-white/5 hover:text-white'

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64 print:pl-0">
      {open && <div onClick={close} className="fixed inset-0 z-30 bg-slate-900/50 md:hidden print:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink text-white transition-transform md:translate-x-0 print:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><GraduationCap className="h-5 w-5 text-accent" /></span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-bold tracking-tight">{schoolName || 'Alemiya Academy'}</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent/90">School Management</p>
          </div>
          <button onClick={close} aria-label="Close menu" className="ml-auto rounded-lg p-1.5 text-white/70 hover:bg-white/10 md:hidden"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavLink to="/" end onClick={close} className={({ isActive }) => `${item} ${isActive ? on : off}`}>
            <LayoutDashboard className="h-[18px] w-[18px]" /> Dashboard
          </NavLink>
          {groups.map((g) => (
            <div key={g.title} className="mt-6">
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-100/50">{g.title}</p>
              <ul className="flex flex-col gap-0.5">
                {g.sections.map((s) => (
                  <li key={s.id}>
                    <Link to={s.path} onClick={close} className={`${item} ${current === s.id ? on : off}`}>
                      <s.icon className="h-[18px] w-[18px]" /> {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link to="/account" onClick={close} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-ink">{initials(profile.full_name)}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{profile.full_name}</span>
              <span className="block text-xs font-medium capitalize text-teal-100/70">{profile.role}</span>
            </span>
          </Link>
          <button onClick={signOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-teal-100/80 hover:bg-white/5 hover:text-white">
            <LogOut className="h-[18px] w-[18px]" /> Log out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8 print:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"><Menu className="h-5 w-5" /></button>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-bold text-slate-900">{schoolName || 'Alemiya Academy'}</p>
          <p className="truncate text-xs font-medium text-slate-500">{currentTerm ? `${currentTerm.name} · Academic year ${currentTerm.year_name}` : 'No current term set'}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700 sm:inline">{profile.role}</span>
          <Link to="/account" aria-label="My account" className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">{initials(profile.full_name)}</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
        {pathname !== '/' && (
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-brand/40 hover:text-brand print:hidden">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <TermBadge />
        <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
      </main>
    </div>
  )
}

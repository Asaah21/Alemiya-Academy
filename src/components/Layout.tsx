import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { sectionIdFor, sectionsFor } from '../features/nav/menu'
import TermBadge from './TermBadge'

// Frame for every logged-in screen: top bar on a phone with a Menu button; side menu on a laptop.
export default function Layout({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  if (state.status !== 'ready') return null
  const { profile } = state
  const groups = sectionsFor(profile.role)
  const current = sectionIdFor(pathname)

  const base = 'block rounded-lg px-4 py-3 text-base font-bold'
  const on = 'bg-brand text-white'
  const off = 'text-slate-800 hover:bg-slate-100'

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <header className="flex items-center justify-between bg-white p-3 shadow-sm md:hidden print:hidden">
        <Link to="/" className="text-xl font-extrabold text-brand">Alemiya Academy</Link>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-lg border-2 border-brand px-4 py-2 font-bold text-brand">
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <nav className={`${open ? 'block' : 'hidden'} bg-white p-3 shadow-sm md:block md:min-h-screen md:w-64 md:shrink-0 print:hidden`}>
        <Link to="/" className="mb-4 hidden px-4 text-xl font-extrabold text-brand md:block">Alemiya Academy</Link>
        <NavLink to="/" end onClick={() => setOpen(false)} className={({ isActive }) => `${base} ${isActive ? on : off}`}>Home</NavLink>
        {groups.map((g) => (
          <div key={g.title} className="mt-4">
            <p className="px-4 pb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{g.title}</p>
            <ul className="flex flex-col gap-1">
              {g.sections.map((s) => (
                <li key={s.id}>
                  <Link to={s.path} onClick={() => setOpen(false)} className={`${base} ${current === s.id ? on : off}`}>{s.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 text-sm">
          <Link to="/account" onClick={() => setOpen(false)} className="px-4 font-bold text-slate-700 underline">
            {profile.full_name}
          </Link>
          <span className="mx-4 w-fit rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold capitalize">{profile.role}</span>
          <button onClick={signOut} className="mx-4 rounded-lg border-2 border-slate-300 px-3 py-3 font-bold">Log out</button>
        </div>
      </nav>

      <main className="w-full max-w-3xl flex-1 p-4 md:p-6 print:max-w-none print:p-0">
        <TermBadge />
        {children}
      </main>
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { menuFor } from '../features/nav/menu'
import TermBadge from './TermBadge'

// Frame for every logged-in screen: top bar on a phone with a Menu button; side menu on a laptop.
export default function Layout({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  if (state.status !== 'ready') return null
  const { profile } = state
  const items = menuFor(profile.role)

  const link = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-4 py-3 text-base font-medium ${isActive ? 'bg-brand text-white' : 'text-slate-800 hover:bg-slate-100'}`

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <header className="flex items-center justify-between bg-white p-3 shadow-sm md:hidden">
        <Link to="/" className="text-lg font-bold text-brand">Alemiya Academy</Link>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-lg border border-slate-300 px-4 py-2 font-medium">
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <nav className={`${open ? 'block' : 'hidden'} bg-white p-3 shadow-sm md:block md:min-h-screen md:w-64 md:shrink-0`}>
        <Link to="/" className="mb-4 hidden px-4 text-lg font-bold text-brand md:block">Alemiya Academy</Link>
        <ul className="flex flex-col gap-1">
          {items.map((m) => (
            <li key={m.path}>
              <NavLink to={m.path} end={m.path === '/'} onClick={() => setOpen(false)} className={link}>
                {m.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 text-sm">
          <Link to="/account" onClick={() => setOpen(false)} className="px-4 font-medium text-slate-700 underline">
            {profile.full_name}
          </Link>
          <span className="mx-4 w-fit rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium capitalize">{profile.role}</span>
          <button onClick={signOut} className="mx-4 rounded-lg border border-slate-300 px-3 py-3 font-medium">Log out</button>
        </div>
      </nav>

      <main className="w-full max-w-3xl flex-1 p-4 md:p-6">
        <TermBadge />
        {children}
      </main>
    </div>
  )
}

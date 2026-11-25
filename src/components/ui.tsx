import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'

// Shared building blocks for the section pages, so every page looks the same.

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: { to: string; label: string; icon: LucideIcon } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm font-medium text-slate-500">{subtitle}</p>}
      </div>
      {action && (
        <Link to={action.to} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-ink sm:w-auto">
          <action.icon className="h-5 w-5" /> {action.label}
        </Link>
      )}
    </div>
  )
}

export function Stat({ icon: Icon, label, value, hint, to }: { icon: LucideIcon; label: string; value: ReactNode; hint?: string; to?: string }) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md md:gap-4 md:p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand md:h-12 md:w-12"><Icon className="h-5 w-5 md:h-6 md:w-6" /></span>
      <div className="min-w-0">
        <p className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{value}</p>
        <p className="text-xs font-semibold leading-tight text-slate-500 md:text-sm">{label}</p>
        {hint && <p className="text-xs font-medium text-slate-400">{hint}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 }) {
  return <section className={`grid grid-cols-2 gap-3 md:gap-4 ${cols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>{children}</section>
}

export type Action = { to: string; label: string; hint: string; icon: LucideIcon }

export function ActionGrid({ actions }: { actions: Action[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((l) => (
        <Link key={l.to} to={l.to} className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow-md">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><l.icon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block text-[15px] font-bold text-slate-900">{l.label}</span>
            <span className="block text-sm font-medium text-slate-500">{l.hint}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>
      ))}
    </section>
  )
}

export function Panel({ title, link, children }: { title: string; link?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {link && <Link to={link.to} className="text-sm font-bold text-brand hover:underline">{link.label}</Link>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

export const ErrorNote = ({ show }: { show: boolean }) =>
  show ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Could not load the numbers. Check your connection and reload.</p> : null

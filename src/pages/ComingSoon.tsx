import { useLocation } from 'react-router-dom'
import { MENU } from '../features/nav/menu'

// Placeholder for screens built in later steps.
export default function ComingSoon() {
  const { pathname } = useLocation()
  const item = MENU.find((m) => m.path === pathname)
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">{item?.label ?? 'Page'}</h1>
      <p className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">
        This screen is not built yet{item?.step ? ` (build step ${item.step})` : ''}.
      </p>
    </div>
  )
}

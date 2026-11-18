import { useEffect, useState } from 'react'
import { checkConnection, type ConnectionStatus } from '../lib/supabase'

const messages: Record<ConnectionStatus | 'checking', { text: string; style: string }> = {
  checking: { text: 'Checking database connection…', style: 'bg-slate-100 text-slate-700' },
  connected: { text: 'Database connected', style: 'bg-green-100 text-green-800' },
  'not-configured': {
    text: 'Database not set up yet: add the two Supabase values to the Netlify environment variables',
    style: 'bg-amber-100 text-amber-900',
  },
  unreachable: {
    text: 'Cannot reach the database: check the Supabase address and public key',
    style: 'bg-red-100 text-red-800',
  },
}

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus | 'checking'>('checking')

  useEffect(() => {
    checkConnection().then(setStatus)
  }, [])

  const m = messages[status]

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-brand">Alemiya Academy</h1>
        <p className="mt-1 text-slate-600">School management system, version 1</p>
      </div>
      <p className={`rounded-xl p-4 text-sm font-medium ${m.style}`}>{m.text}</p>
      <p className="text-xs text-slate-500">Build step T01: project skeleton</p>
    </main>
  )
}

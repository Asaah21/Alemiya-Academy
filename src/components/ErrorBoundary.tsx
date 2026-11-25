import { Component, type ReactNode } from 'react'

// If a screen breaks, show a calm message with a way out instead of a blank page.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Something went wrong on this screen</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">Nothing you saved was lost. Reload the page, or go back to the dashboard.</p>
        <div className="mt-5 flex justify-center gap-3">
          <button onClick={() => window.location.reload()} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white">Reload</button>
          <a href="/" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Dashboard</a>
        </div>
      </div>
    )
  }
}

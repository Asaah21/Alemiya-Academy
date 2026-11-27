import { useEffect, useRef, useState } from 'react'

// Shows every page of a PDF as pictures at the full width of the screen. Phones cannot show a PDF inside a page,
// so this draws the pages ourselves. The PDF reader is loaded only when a PDF is shown.
export default function PdfPages({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    ;(async () => {
      try {
        const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        const doc = await pdfjs.getDocument({ url }).promise
        const host = box.current
        if (!host || cancelled) return
        host.replaceChildren()
        const width = host.clientWidth || 800
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          if (cancelled) return
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: (width / base.width) * ratio })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.cssText = 'width:100%;height:auto;display:block;border:1px solid #e2e8f0;border-radius:8px;background:#fff'
          host.appendChild(canvas)
          await page.render({ canvas, viewport }).promise
        }
        if (!cancelled) setState('ready')
      } catch {
        if (!cancelled) setState('failed')
      }
    })()
    return () => { cancelled = true }
  }, [url])

  return (
    <div>
      {state === 'loading' && <p className="text-sm font-medium text-slate-500">Loading the timetable…</p>}
      {state === 'failed' && <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">The timetable could not be shown here. Press View or Download to open it.</p>}
      <div ref={box} className="flex flex-col gap-4" />
    </div>
  )
}

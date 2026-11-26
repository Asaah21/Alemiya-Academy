// Turns the report card(s) on screen into an A4 PDF. The libraries are loaded only when someone presses Download.
// Each page is copied into a hidden, full-size holder first, so the PDF looks the same no matter how the
// screen is laid out (phone, narrow column, scaled preview).
const PAGE_W = 794 // A4 width at 96 dpi
const PAGE_H = 1123

export async function downloadPdf(elements: HTMLElement[], fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const holder = document.createElement('div')
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;background:#fff;z-index:-1`
  document.body.appendChild(holder)
  try {
    for (let i = 0; i < elements.length; i++) {
      const clone = elements[i].cloneNode(true) as HTMLElement
      clone.style.cssText += `;transform:none;margin:0;width:${PAGE_W}px;height:${PAGE_H}px;min-height:${PAGE_H}px;box-shadow:none;`
      holder.replaceChildren(clone)
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const canvas = await html2canvas(clone, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true,
        width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, scrollX: 0, scrollY: 0,
      })
      if (i > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
    }
  } finally {
    holder.remove()
  }
  pdf.save(fileName)
}

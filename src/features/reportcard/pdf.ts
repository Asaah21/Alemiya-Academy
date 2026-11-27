// Turns the report card(s) on screen into an A4 PDF. The libraries are loaded only when someone presses Download.
// Each page is copied into a hidden, full-size holder with every style written directly onto it, so the PDF looks
// the same whatever the screen is like (phone, narrow column, scaled preview) and does not depend on stylesheets.
const PAGE_W = 794 // A4 width at 96 dpi
const PAGE_H = 1123

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src)
  let css = ''
  for (let i = 0; i < cs.length; i++) css += `${cs[i]}:${cs.getPropertyValue(cs[i])};`
  ;(dst as HTMLElement).style.cssText = css
  const a = src.children
  const b = dst.children
  for (let i = 0; i < a.length; i++) if (b[i]) inlineStyles(a[i], b[i])
}

export async function renderPdf(elements: HTMLElement[]): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const holder = document.createElement('div')
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;background:#fff;z-index:-1`
  document.body.appendChild(holder)
  try {
    for (let i = 0; i < elements.length; i++) {
      const clone = elements[i].cloneNode(true) as HTMLElement
      inlineStyles(elements[i], clone)
      clone.style.transform = 'none'
      clone.style.margin = '0'
      clone.style.width = `${PAGE_W}px`
      clone.style.height = `${PAGE_H}px`
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
  return pdf.output('blob')
}

export async function downloadPdf(elements: HTMLElement[], fileName: string): Promise<void> {
  const blob = await renderPdf(elements)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

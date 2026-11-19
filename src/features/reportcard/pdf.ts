// Turns the report card(s) on screen into an A4 PDF. The libraries are loaded only when someone presses Download.
export async function downloadPdf(elements: HTMLElement[], fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  for (let i = 0; i < elements.length; i++) {
    const canvas = await html2canvas(elements[i], {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      // the page is shown scaled down on a phone; capture it at full size
      onclone: (doc) => doc.querySelectorAll<HTMLElement>('[data-rc-scale]').forEach((el) => { el.style.transform = 'none'; el.style.width = 'auto'; el.style.height = 'auto' }),
    })
    if (i > 0) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
  }
  pdf.save(fileName)
}

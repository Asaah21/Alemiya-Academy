import { formatMoney } from '../../lib/fees'
import { receiptDate } from '../../lib/payments'

export type ReceiptData = {
  receiptNo: string
  schoolName: string
  location: string
  studentName: string
  admissionNo: string
  className: string
  termLabel: string
  amount: number
  paidOn: string
  note: string | null
  receivedBy: string
  balanceAfter: number | null
  voided?: boolean
}

// A half-page receipt. Prints on the school A4 printer from the browser's Print.
export default function Receipt({ r }: { r: ReceiptData }) {
  return (
    <section className="relative mx-auto w-full max-w-[148mm] border-2 border-slate-800 bg-white p-5 text-slate-900 print:max-w-none">
      {r.voided && <p className="absolute right-4 top-4 rotate-6 border-2 border-red-600 px-2 text-lg font-bold text-red-600">VOID</p>}
      <header className="border-b border-slate-400 pb-2 text-center">
        <h2 className="text-xl font-bold uppercase">{r.schoolName}</h2>
        {r.location && <p className="text-sm">{r.location}</p>}
        <p className="mt-1 font-semibold tracking-wide">PAYMENT RECEIPT</p>
      </header>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-semibold">Receipt no.</dt>
        <dd className="font-bold">{r.receiptNo}</dd>
        <dt className="font-semibold">Date</dt>
        <dd>{receiptDate(r.paidOn)}</dd>
        <dt className="font-semibold">Student</dt>
        <dd>{r.studentName}</dd>
        <dt className="font-semibold">Admission no.</dt>
        <dd>{r.admissionNo}</dd>
        <dt className="font-semibold">Class</dt>
        <dd>{r.className}</dd>
        <dt className="font-semibold">Term</dt>
        <dd>{r.termLabel}</dd>
        {r.note && (
          <>
            <dt className="font-semibold">Note</dt>
            <dd>{r.note}</dd>
          </>
        )}
      </dl>
      <p className="my-3 border-y-2 border-slate-800 py-2 text-center text-2xl font-bold tracking-tight text-slate-900">{formatMoney(r.amount)}</p>
      {r.balanceAfter !== null && (
        <p className="text-sm">
          Balance still owed for this term: <strong>{formatMoney(Math.max(r.balanceAfter, 0))}</strong>
          {r.balanceAfter < 0 && ` (paid ${formatMoney(-r.balanceAfter)} in advance)`}
        </p>
      )}
      <footer className="mt-6 flex justify-between text-sm">
        <p>
          Received by: <strong>{r.receivedBy || '…………………'}</strong>
        </p>
        <p>Signature: ……………………</p>
      </footer>
    </section>
  )
}

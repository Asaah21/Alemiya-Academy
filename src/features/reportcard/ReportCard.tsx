import type { CardData } from '../../lib/report-card'
import { ordinal } from '../../lib/report-card'
import { formatDate } from '../../lib/terms'
import './report-card.css'

const dash = (v: number | null) => (v === null ? '' : String(v))

// One report card = one A4 page (rules C1, C2). Remarks-only classes (rule G8) get no score table.
export default function ReportCard({ card }: { card: CardData }) {
  const s = card.school
  const place = [s.location, s.district, s.region].filter(Boolean).join(', ')
  return (
    <section className="rc-page" data-report-card={card.studentId}>
      <header className="rc-head">
        {s.logoUrl && <img className="rc-logo" src={s.logoUrl} alt="" crossOrigin="anonymous" />}
        <div className="rc-school">
          <h1>{s.name || 'School name'}</h1>
          {place && <p>{place}</p>}
          {s.circuit && <p>Circuit: {s.circuit}</p>}
        </div>
        {s.logoUrl && <div className="rc-logo" aria-hidden />}
      </header>

      <p className="rc-title">Terminal report: {card.termName}, {card.yearName}</p>

      <div className="rc-info">
        <div><span>Name</span><span>{card.studentName}</span></div>
        <div><span>Admission no.</span><span>{card.admissionNo}</span></div>
        <div><span>Class</span><span>{card.className}</span></div>
        <div><span>Class size</span><span>{card.classSize}</span></div>
      </div>

      {card.scored && (
        <table className="rc-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Score<br />/{s.examMax}</th>
              {card.showGrades && <th>Grade</th>}
              {card.showGrades && <th>Remark</th>}
            </tr>
          </thead>
          <tbody>
            {card.subjects.map((sub) => (
              <tr key={sub.name}>
                <td>{sub.name}</td>
                {sub.absent ? <td className="rc-absent">Absent</td> : <td><strong>{dash(sub.total)}</strong></td>}
                {card.showGrades && <td><strong>{sub.grade}</strong></td>}
                {card.showGrades && <td className="rc-remark">{sub.remark}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Overall total</td>
              <td>{dash(card.overall)}</td>
              {card.showGrades && <td colSpan={2} />}
            </tr>
          </tfoot>
        </table>
      )}

      <div className="rc-summary">
        {card.scored && <div><small>Average</small><strong>{card.average ?? ''}</strong></div>}
        {card.scored && <div><small>Position</small><strong>{card.position ? `${ordinal(card.position)} of ${card.classSize}` : ''}</strong></div>}
        <div><small>Attendance</small><strong>{card.attendance ? `${card.attendance.present} of ${card.attendance.schoolDays} days` : 'Not recorded'}</strong></div>
        <div><small>Next term opens</small><strong>{s.nextTermOpening ? formatDate(s.nextTermOpening) : ''}</strong></div>
      </div>

      <div className="rc-remarks">
        <div className="rc-remark-box"><small>Class teacher's remark</small><p>{card.teacherRemark}</p></div>
        <div className="rc-remark-box"><small>Headmaster's remark</small><p>{card.headRemark}</p></div>
      </div>

      <footer className="rc-foot">
        <div className="rc-sign">Class teacher's signature</div>
        <div className="rc-sign">Headmaster's signature</div>
      </footer>
    </section>
  )
}

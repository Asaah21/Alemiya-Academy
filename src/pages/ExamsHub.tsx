import { useEffect, useState } from 'react'
import { BadgeCheck, ClipboardCheck, FileText, ListOrdered, MessageSquareText, PenLine } from 'lucide-react'
import { ActionGrid, ErrorNote, PageHeader, Stat, StatGrid, type Action } from '../components/ui'
import { useSchool } from '../features/school/SchoolProvider'
import { supabase } from '../lib/supabase'

type Nums = { scores: number; remarks: number; published: number; classes: number }

const ACTIONS: Action[] = [
  { to: '/remarks', label: 'Remarks', hint: 'Teacher and head remarks', icon: MessageSquareText },
  { to: '/scores/results', label: 'Class results', hint: 'Totals, grades and positions', icon: ListOrdered },
  { to: '/report-cards', label: 'Report cards', hint: 'View, print, download', icon: FileText },
]

export default function ExamsHub() {
  const { currentTerm } = useSchool()
  const [n, setN] = useState<Nums | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!currentTerm) return
    const term = currentTerm.id
    Promise.all([
      supabase!.from('scores').select('id', { count: 'exact', head: true }).eq('term_id', term),
      supabase!.from('report_remarks').select('id', { count: 'exact', head: true }).eq('term_id', term),
      supabase!.from('results_publish').select('id', { count: 'exact', head: true }).eq('term_id', term),
      supabase!.from('classes').select('id', { count: 'exact', head: true }).eq('scored', true),
    ]).then(([s, r, p, c]) => {
      if (s.error || r.error || p.error || c.error) return setError(true)
      setN({ scores: s.count ?? 0, remarks: r.count ?? 0, published: p.count ?? 0, classes: c.count ?? 0 })
    })
  }, [currentTerm])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Exams" subtitle={currentTerm ? `${currentTerm.name}, ${currentTerm.year_name}` : 'Scores, remarks and report cards'} action={{ to: '/scores', label: 'Enter scores', icon: ClipboardCheck }} />
      <ErrorNote show={error} />
      <StatGrid cols={3}>
        <Stat icon={PenLine} label="Scores entered this term" value={n ? n.scores : '–'} />
        <Stat icon={MessageSquareText} label="Remarks written" value={n ? n.remarks : '–'} />
        <Stat icon={BadgeCheck} label="Classes published to parents" value={n ? `${n.published} of ${n.classes}` : '–'} />
      </StatGrid>
      <ActionGrid actions={ACTIONS} />
    </div>
  )
}

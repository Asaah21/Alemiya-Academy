import { Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Account from './pages/Account'
import AttendanceSummary from './pages/AttendanceSummary'
import Classes from './pages/Classes'
import EnterScores from './pages/EnterScores'
import FeeItems from './pages/FeeItems'
import Grades from './pages/Grades'
import ImportStudents from './pages/ImportStudents'
import StudentForm from './pages/StudentForm'
import Students from './pages/Students'
import Subjects from './pages/Subjects'
import WeeklyAttendance from './pages/WeeklyAttendance'
import ClassResults from './pages/ClassResults'
import SchoolDetails from './pages/SchoolDetails'
import Balances from './pages/Balances'
import DailyCash from './pages/DailyCash'
import ParentHome from './pages/ParentHome'
import ParentLogin from './pages/ParentLogin'
import ParentSlips from './pages/ParentSlips'
import Payments from './pages/Payments'
import Remarks from './pages/Remarks'
import Reports from './pages/Reports'
import ReportCards from './pages/ReportCards'
import Setup from './pages/Setup'
import Staff from './pages/Staff'
import StaffAttendance from './pages/StaffAttendance'
import SummaryReports from './pages/SummaryReports'
import TermClose from './pages/TermClose'
import Hub from './pages/Hub'
import StudentsHub from './pages/StudentsHub'
import StaffHub from './pages/StaffHub'
import ExamsHub from './pages/ExamsHub'
import FeesHub from './pages/FeesHub'
import Promotion from './pages/Promotion'
import Backup from './pages/Backup'
import Turnover from './pages/Turnover'
import StaffSummary from './pages/StaffSummary'
import Years from './pages/Years'
import Home from './pages/Home'
import Login from './pages/Login'
import Users from './pages/Users'

// Add one <Route> per screen as each module is built (see the build plan, section 7).
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/parent" element={<ParentLogin />} />
      <Route path="/parent/home" element={<ParentHome />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/hub/students" element={<RequireAuth><StudentsHub /></RequireAuth>} />
      <Route path="/hub/staff" element={<RequireAuth role="admin"><StaffHub /></RequireAuth>} />
      <Route path="/hub/exams" element={<RequireAuth><ExamsHub /></RequireAuth>} />
      <Route path="/hub/fees" element={<RequireAuth><FeesHub /></RequireAuth>} />
      <Route path="/hub/:id" element={<RequireAuth><Hub /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="/fees" element={<RequireAuth><Payments /></RequireAuth>} />
      <Route path="/fees/balances" element={<RequireAuth><Balances /></RequireAuth>} />
      <Route path="/fees/cash" element={<RequireAuth role="admin"><DailyCash /></RequireAuth>} />
      <Route path="/students" element={<RequireAuth><Students /></RequireAuth>} />
      <Route path="/students/import" element={<RequireAuth role="admin"><ImportStudents /></RequireAuth>} />
      <Route path="/students/new" element={<RequireAuth><StudentForm /></RequireAuth>} />
      <Route path="/students/:id" element={<RequireAuth><StudentForm /></RequireAuth>} />
      <Route path="/attendance" element={<RequireAuth><WeeklyAttendance /></RequireAuth>} />
      <Route path="/attendance/summary" element={<RequireAuth><AttendanceSummary /></RequireAuth>} />
      <Route path="/staff-attendance" element={<RequireAuth role="admin"><StaffAttendance /></RequireAuth>} />
      <Route path="/staff-attendance/summary" element={<RequireAuth role="admin"><StaffSummary /></RequireAuth>} />
      <Route path="/report-cards" element={<RequireAuth><ReportCards /></RequireAuth>} />
      <Route path="/remarks" element={<RequireAuth><Remarks /></RequireAuth>} />
      <Route path="/scores/results" element={<RequireAuth><ClassResults /></RequireAuth>} />
      <Route path="/scores" element={<RequireAuth><EnterScores /></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth role="admin"><Reports /></RequireAuth>} />
      <Route path="/reports/summary" element={<RequireAuth role="admin"><SummaryReports /></RequireAuth>} />
      <Route path="/reports/turnover" element={<RequireAuth role="admin"><Turnover /></RequireAuth>} />
      <Route path="/setup" element={<RequireAuth role="admin"><Setup /></RequireAuth>} />
      <Route path="/setup/school" element={<RequireAuth role="admin"><SchoolDetails /></RequireAuth>} />
      <Route path="/setup/years" element={<RequireAuth role="admin"><Years /></RequireAuth>} />
      <Route path="/setup/classes" element={<RequireAuth role="admin"><Classes /></RequireAuth>} />
      <Route path="/setup/subjects" element={<RequireAuth role="admin"><Subjects /></RequireAuth>} />
      <Route path="/setup/grades" element={<RequireAuth role="admin"><Grades /></RequireAuth>} />
      <Route path="/setup/close" element={<RequireAuth role="admin"><TermClose /></RequireAuth>} />
      <Route path="/setup/promotion" element={<RequireAuth role="admin"><Promotion /></RequireAuth>} />
      <Route path="/setup/backup" element={<RequireAuth role="admin"><Backup /></RequireAuth>} />
      <Route path="/setup/fees" element={<RequireAuth role="admin"><FeeItems /></RequireAuth>} />
      <Route path="/setup/parents" element={<RequireAuth role="admin"><ParentSlips /></RequireAuth>} />
      <Route path="/setup/staff" element={<RequireAuth role="admin"><Staff /></RequireAuth>} />
      <Route path="/setup/users" element={<RequireAuth role="admin"><Users /></RequireAuth>} />
    </Routes>
  )
}

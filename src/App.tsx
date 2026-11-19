import { Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Account from './pages/Account'
import AttendanceSummary from './pages/AttendanceSummary'
import Classes from './pages/Classes'
import EnterScores from './pages/EnterScores'
import Grades from './pages/Grades'
import ImportStudents from './pages/ImportStudents'
import StudentForm from './pages/StudentForm'
import Students from './pages/Students'
import Subjects from './pages/Subjects'
import WeeklyAttendance from './pages/WeeklyAttendance'
import ClassResults from './pages/ClassResults'
import ComingSoon from './pages/ComingSoon'
import SchoolDetails from './pages/SchoolDetails'
import Setup from './pages/Setup'
import Staff from './pages/Staff'
import StaffAttendance from './pages/StaffAttendance'
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
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      {['/report-cards', '/fees'].map((p) => (
        <Route key={p} path={p} element={<RequireAuth><ComingSoon /></RequireAuth>} />
      ))}
      <Route path="/students" element={<RequireAuth><Students /></RequireAuth>} />
      <Route path="/students/import" element={<RequireAuth role="admin"><ImportStudents /></RequireAuth>} />
      <Route path="/students/new" element={<RequireAuth><StudentForm /></RequireAuth>} />
      <Route path="/students/:id" element={<RequireAuth><StudentForm /></RequireAuth>} />
      <Route path="/attendance" element={<RequireAuth><WeeklyAttendance /></RequireAuth>} />
      <Route path="/attendance/summary" element={<RequireAuth><AttendanceSummary /></RequireAuth>} />
      <Route path="/staff-attendance" element={<RequireAuth role="admin"><StaffAttendance /></RequireAuth>} />
      <Route path="/staff-attendance/summary" element={<RequireAuth role="admin"><StaffSummary /></RequireAuth>} />
      <Route path="/scores/results" element={<RequireAuth><ClassResults /></RequireAuth>} />
      <Route path="/scores" element={<RequireAuth><EnterScores /></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth role="admin"><ComingSoon /></RequireAuth>} />
      <Route path="/setup" element={<RequireAuth role="admin"><Setup /></RequireAuth>} />
      <Route path="/setup/school" element={<RequireAuth role="admin"><SchoolDetails /></RequireAuth>} />
      <Route path="/setup/years" element={<RequireAuth role="admin"><Years /></RequireAuth>} />
      <Route path="/setup/classes" element={<RequireAuth role="admin"><Classes /></RequireAuth>} />
      <Route path="/setup/subjects" element={<RequireAuth role="admin"><Subjects /></RequireAuth>} />
      <Route path="/setup/grades" element={<RequireAuth role="admin"><Grades /></RequireAuth>} />
      <Route path="/setup/staff" element={<RequireAuth role="admin"><Staff /></RequireAuth>} />
      <Route path="/setup/users" element={<RequireAuth role="admin"><Users /></RequireAuth>} />
    </Routes>
  )
}

import { Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Account from './pages/Account'
import ComingSoon from './pages/ComingSoon'
import Setup from './pages/Setup'
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
      {['/students', '/attendance', '/scores', '/report-cards', '/fees'].map((p) => (
        <Route key={p} path={p} element={<RequireAuth><ComingSoon /></RequireAuth>} />
      ))}
      <Route path="/reports" element={<RequireAuth role="admin"><ComingSoon /></RequireAuth>} />
      <Route path="/setup" element={<RequireAuth role="admin"><Setup /></RequireAuth>} />
      <Route path="/setup/users" element={<RequireAuth role="admin"><Users /></RequireAuth>} />
    </Routes>
  )
}

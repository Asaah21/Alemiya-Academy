import { Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Account from './pages/Account'
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
      <Route path="/setup/users" element={<RequireAuth role="admin"><Users /></RequireAuth>} />
    </Routes>
  )
}

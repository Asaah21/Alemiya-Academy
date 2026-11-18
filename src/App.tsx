import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'

// T04 will replace this with the full menu and layout.
// Add one <Route> per screen as each module is built (see the build plan, section 7).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}

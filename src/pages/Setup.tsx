import { Link } from 'react-router-dom'

// Setup home. T06 onward add the other setup screens here.
export default function Setup() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Setup</h1>
      <Link to="/setup/school" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        School details
      </Link>
      <Link to="/setup/years" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        Academic years and terms
      </Link>
      <Link to="/setup/classes" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        Classes
      </Link>
      <Link to="/setup/subjects" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        Subjects
      </Link>
      <Link to="/setup/grades" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        Grading scale
      </Link>
      <Link to="/setup/staff" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        Staff list
      </Link>
      <Link to="/setup/users" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        Users: add staff, reset passwords
      </Link>
    </div>
  )
}

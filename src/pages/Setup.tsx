import { Link } from 'react-router-dom'

// Setup home. T06 onward add the other setup screens here.
export default function Setup() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Setup</h1>
      <Link to="/setup/users" className="rounded-xl bg-white p-4 font-medium shadow-sm">
        Users: add staff, reset passwords
      </Link>
    </div>
  )
}

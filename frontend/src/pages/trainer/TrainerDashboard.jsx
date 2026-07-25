import Navbar from '../../components/Navbar'
import { useAuth } from '../../context/AuthContext'

export default function TrainerDashboard() {
  const { profile } = useAuth()
  return (
    <div className="app-shell">
      <Navbar />
      <div className="main">
        <div className="card">
          <h3>Welcome, {profile?.full_name}</h3>
          <p className="empty-state">
            Trainer view — assigned individuals' progress, workout comments — is next on the roadmap.
          </p>
        </div>
      </div>
    </div>
  )
}
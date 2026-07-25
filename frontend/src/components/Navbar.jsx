import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="topbar">
      <div className="brand">
        Motion<span className="accent">X</span>
      </div>
      <div className="topbar-right">
        <div className="user-chip">
          <span className="name">{profile?.full_name}</span>
          <span className="badge badge-accent">{profile?.role}</span>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  )
}

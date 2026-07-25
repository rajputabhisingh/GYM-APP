import { Navigate } from 'react-router-dom'
import { useAuth, dashboardPathForRole } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { profile, token, loading } = useAuth()

  if (loading) return null

  if (!token || !profile) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={dashboardPathForRole(profile.role)} replace />
  }

  return children
}

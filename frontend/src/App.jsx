import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Signup from './pages/Signup'
import OwnerSignup from './pages/OwnerSignup'
import IndividualSignup from './pages/IndividualSignup'
import TrainerSignup from './pages/TrainerSignup'
import Login from './pages/Login'
import IndividualDashboard from './pages/individual/IndividualDashboard'
import TrainerDashboard from './pages/trainer/TrainerDashboard'
import OwnerDashboard from './pages/owner/OwnerDashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signup/owner" element={<OwnerSignup />} />
          <Route path="/signup/individual" element={<IndividualSignup />} />
          <Route path="/signup/trainer" element={<TrainerSignup />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/individual"
            element={
              <ProtectedRoute allowedRoles={['individual']}>
                <IndividualDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainer"
            element={
              <ProtectedRoute allowedRoles={['trainer']}>
                <TrainerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
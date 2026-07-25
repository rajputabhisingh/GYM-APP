import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, dashboardPathForRole } from '../context/AuthContext'
import { getErrorMessage } from '../utils/errorMessage'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const profile = await login(email, password)
      navigate(dashboardPathForRole(profile.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <h1>
          Welcome <span className="accent">back.</span>
        </h1>
        <p>Pick up where you left off — today's session is waiting.</p>
      </div>
      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Log in</h2>
          <p className="subtitle">Enter your credentials to continue.</p>

          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>

          {error && <div className="error-text">{error}</div>}

          <div className="auth-switch">
            New here? <Link to="/signup">Create an account</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
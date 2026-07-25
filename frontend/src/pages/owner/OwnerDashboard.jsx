import { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar'
import client from '../../api/client'
import Spinner from '../../components/Spinner'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/errorMessage'

export default function OwnerDashboard() {
  const { profile } = useAuth()
  const [gym, setGym] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    client
      .get('/gyms/me')
      .then((res) => setGym(res.data))
      .catch((err) => setError(getErrorMessage(err, 'Could not load gym details.')))
      .finally(() => setLoading(false))
  }, [])

  function copyCode() {
    if (!gym?.gym_code) return
    navigator.clipboard.writeText(gym.gym_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="app-shell">
      <Navbar />
      <div className="main">
        <div className="stack">
          <div className="card">
            <h3>Welcome, {profile?.full_name}</h3>
            {loading && <Spinner label="Loading gym details…" />}
            {error && <div className="error-text">{error}</div>}

            {gym && (
              <div style={{ marginTop: 8 }}>
                <div className="meta">{gym.gym_name}</div>
                <div className="meta">{gym.address} — {gym.pin_code}</div>

                <div style={{ marginTop: 18 }}>
                  <label>Gym Code</label>
                  {gym.gym_code ? (
                    <div className="row" style={{ alignItems: 'center', marginTop: 6 }}>
                      <span className="badge badge-accent" style={{ fontSize: 16, padding: '8px 14px' }}>
                        {gym.gym_code}
                      </span>
                      <button type="button" className="btn btn-ghost" onClick={copyCode}>
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <p className="empty-state" style={{ textAlign: 'left', padding: 0 }}>
                      Pending — your Gym Code is generated automatically once you verify your
                      email. Check your inbox for the verification link.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <p className="empty-state">
              Individual/Trainer join-with-Gym-Code, member progress, attendance — next modules.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
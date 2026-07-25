import { useEffect, useState } from 'react'
import client from '../../api/client'

export default function SettingsTab() {
  const [me, setMe] = useState(null)
  const [sessionCount, setSessionCount] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([client.get('/auth/me'), client.get('/workouts', { params: { limit: 200 } })])
      .then(([meRes, workoutsRes]) => {
        setMe(meRes.data)
        setSessionCount(workoutsRes.data.length)
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Could not load account details.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="empty-state">Loading…</p>
  if (error) return <div className="error-text">{error}</div>
  if (!me) return null

  return (
    <div className="stack">
      <div className="card">
        <h3>Account</h3>
        <div className="stack" style={{ gap: 12, marginTop: 12 }}>
          <div>
            <div className="meta">Full name</div>
            <div>{me.full_name}</div>
          </div>
          <div>
            <div className="meta">Username</div>
            <div>{me.username || '—'}</div>
          </div>
          <div>
            <div className="meta">Email</div>
            <div>{me.email}</div>
          </div>
          <div>
            <div className="meta">Phone</div>
            <div>{me.phone || '—'}</div>
          </div>
          <div>
            <div className="meta">Role</div>
            <span className="badge badge-accent">{me.role}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="meta">Sessions logged</div>
        <h2 style={{ margin: 0 }}>{sessionCount}</h2>
      </div>
    </div>
  )
}
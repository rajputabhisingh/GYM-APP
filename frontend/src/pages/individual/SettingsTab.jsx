import { useEffect, useState } from 'react'
import client from '../../api/client'
import Spinner from '../../components/Spinner'
import { useCountUp } from '../../hooks/useCountUp'

const GOAL_OPTIONS = [
  'Build strength',
  'Build muscle',
  'Lose weight',
  'Gain weight',
  'Improve stamina',
  'General fitness',
]

export default function SettingsTab() {
  const [me, setMe] = useState(null)
  const [sessionCount, setSessionCount] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const animatedCount = useCountUp(sessionCount || 0)

  const [selectedGoals, setSelectedGoals] = useState([])
  const [customGoal, setCustomGoal] = useState('')
  const [savingGoals, setSavingGoals] = useState(false)
  const [goalsSaved, setGoalsSaved] = useState(false)

  useEffect(() => {
    Promise.all([client.get('/auth/me'), client.get('/workouts', { params: { limit: 200 } })])
      .then(([meRes, workoutsRes]) => {
        setMe(meRes.data)
        setSessionCount(workoutsRes.data.length)
        setSelectedGoals(meRes.data.goals || [])
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Could not load account details.'))
      .finally(() => setLoading(false))
  }, [])

  function toggleGoal(goal) {
    setGoalsSaved(false)
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  async function handleSaveGoals() {
    setSavingGoals(true)
    setGoalsSaved(false)
    try {
      const finalGoals = customGoal.trim()
        ? [...selectedGoals, customGoal.trim()]
        : selectedGoals
      const res = await client.patch('/auth/goals', { goals: finalGoals })
      setMe(res.data)
      setSelectedGoals(res.data.goals || [])
      setCustomGoal('')
      setGoalsSaved(true)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not save goals.')
    } finally {
      setSavingGoals(false)
    }
  }

  if (loading) return <Spinner label="Loading account…" />
  if (error) return <div className="error-text">{error}</div>
  if (!me) return null

  return (
    <div className="stack">
      <div className="card">
        <h3>Your goals</h3>
        <div className="category-chips" style={{ marginTop: 12 }}>
          {GOAL_OPTIONS.map((goal) => (
            <button
              key={goal}
              type="button"
              className={`chip${selectedGoals.includes(goal) ? ' active' : ''}`}
              onClick={() => toggleGoal(goal)}
            >
              {goal}
            </button>
          ))}
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <input
            className="input"
            value={customGoal}
            onChange={(e) => {
              setCustomGoal(e.target.value)
              setGoalsSaved(false)
            }}
            placeholder="Something else? Type it here"
          />
        </div>
        <button type="button" className="btn" onClick={handleSaveGoals} disabled={savingGoals}>
          {savingGoals ? 'Saving…' : 'Save goals'}
        </button>
        {goalsSaved && <p className="success-text" style={{ marginTop: 8 }}>Goals saved.</p>}
      </div>

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
        <p className="stat-number">{Math.round(animatedCount)}</p>
      </div>
    </div>
  )
}
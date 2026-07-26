import { useEffect, useState } from 'react'
import client from '../api/client'

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay() || 7 // Mon=1 ... Sun=7
  date.setDate(date.getDate() - day + 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function fmtVolume(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${Math.round(kg)}kg`
}

function fmtWeekChange(current, previous) {
  if (!previous) return current > 0 ? 'new this week' : '— vs last wk'
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return '0% vs last wk'
  return `${pct > 0 ? '↑' : '↓'}${Math.abs(pct)}% vs last wk`
}

function e1rm(weightKg, reps) {
  if (!weightKg || !reps || reps > 12) return 0
  return weightKg * (1 + reps / 30)
}

function formatGroup(group) {
  return group.replace(/_/g, ' ')
}

export default function SidePanel({ onEditGoals, refreshKey }) {
  const [goals, setGoals] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([client.get('/auth/me'), client.get('/workouts', { params: { limit: 200 } })])
      .then(([meRes, workoutsRes]) => {
        setGoals(meRes.data.goals || [])
        setWorkouts(workoutsRes.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshKey])

  if (loading) return null

  const thisWeekStart = startOfWeek(new Date())
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  let thisWeekCount = 0
  let thisWeekVolume = 0
  let lastWeekVolume = 0
  let allTimeVolume = 0
  let bestE1rm = 0
  const muscleSessionCount = {}

  for (const w of workouts) {
    const wDate = new Date(`${w.workout_date}T00:00:00`)
    let sessionVolume = 0
    const musclesInSession = new Set()

    for (const we of w.workout_exercises || []) {
      const group = we.exercise?.muscle_group
      if (group) musclesInSession.add(group)
      for (const s of we.sets || []) {
        const weight = s.weight_kg || 0
        const reps = s.reps || 0
        if (weight > 0 && reps > 0) {
          sessionVolume += weight * reps
          const e = e1rm(weight, reps)
          if (e > bestE1rm) bestE1rm = e
        }
      }
    }

    for (const group of musclesInSession) {
      muscleSessionCount[group] = (muscleSessionCount[group] || 0) + 1
    }

    allTimeVolume += sessionVolume

    if (wDate >= thisWeekStart) {
      thisWeekCount += 1
      thisWeekVolume += sessionVolume
    } else if (wDate >= lastWeekStart && wDate < thisWeekStart) {
      lastWeekVolume += sessionVolume
    }
  }

  const lastSession = [...workouts].sort((a, b) => (a.workout_date < b.workout_date ? 1 : -1))[0]
  const muscleFocus = Object.entries(muscleSessionCount).sort((a, b) => b[1] - a[1])

  return (
    <div className="side-panel">
      <div className="card">
        <h4 className="panel-heading">Your goals</h4>
        <div className="category-chips" style={{ marginTop: 10 }}>
          {goals.length === 0 && <span className="meta">No goals set yet</span>}
          {goals.map((g) => (
            <span key={g} className="chip active">
              {g}
            </span>
          ))}
        </div>
        {onEditGoals && (
          <button type="button" className="btn-link" onClick={onEditGoals} style={{ marginTop: 10 }}>
            Edit goals →
          </button>
        )}
      </div>

      <div className="card">
        <h4 className="panel-heading">This week</h4>
        <div className="snapshot-stats">
          <div>
            <div className="stat-number">{thisWeekCount}</div>
            <div className="meta">workouts</div>
          </div>
          <div>
            <div className="stat-number">{fmtVolume(thisWeekVolume)}</div>
            <div className="meta">volume</div>
          </div>
        </div>
        <div className="meta" style={{ marginTop: 10 }}>
          {fmtWeekChange(thisWeekVolume, lastWeekVolume)}
        </div>
      </div>

      <div className="card">
        <h4 className="panel-heading">All time</h4>
        <div className="snapshot-stats">
          <div>
            <div className="stat-number">{workouts.length}</div>
            <div className="meta">sessions</div>
          </div>
          <div>
            <div className="stat-number">{fmtVolume(allTimeVolume)}</div>
            <div className="meta">total volume</div>
          </div>
        </div>
        {bestE1rm > 0 && (
          <div className="meta" style={{ marginTop: 10 }}>
            Best estimated 1RM: {(Math.round(bestE1rm * 10) / 10).toFixed(1)}kg
          </div>
        )}
      </div>

      {muscleFocus.length > 0 && (
        <div className="card">
          <h4 className="panel-heading">Muscle focus</h4>
          <div className="muscle-focus-list">
            {muscleFocus.map(([group, count]) => (
              <div key={group} className="muscle-focus-row">
                <span className="muscle-focus-name">{formatGroup(group)}</span>
                <span className="muscle-focus-count">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h4 className="panel-heading">Last session</h4>
        {lastSession ? (
          <>
            <div>{lastSession.title || 'Untitled session'}</div>
            <div className="meta">{(lastSession.workout_exercises || []).length} exercises</div>
          </>
        ) : (
          <div className="meta">No sessions yet</div>
        )}
      </div>
    </div>
  )
}
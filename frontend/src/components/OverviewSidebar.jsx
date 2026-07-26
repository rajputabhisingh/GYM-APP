import { useEffect, useState, useMemo } from 'react'
import client from '../api/client'
import { getErrorMessage } from '../utils/errorMessage'
import Spinner from './Spinner'

function getWeekRange(offsetWeeks = 0) {
  const now = new Date()
  const day = now.getDay() || 7 // Sunday(0) -> 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 + offsetWeeks * 7)
  const start = monday.toISOString().slice(0, 10)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const end = sunday.toISOString().slice(0, 10)
  return { start, end }
}

function computeDelta(current, previous) {
  if (previous === 0) {
    return current === 0 ? { pct: 0, dir: 'same' } : { pct: 100, dir: 'up' }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same' }
}

function DeltaLabel({ delta }) {
  if (!delta) return null
  const color = delta.dir === 'down' ? 'var(--danger)' : 'var(--success)'
  const arrow = delta.dir === 'down' ? '↓' : '↑'
  return (
    <div className="meta" style={{ color, marginTop: 2 }}>
      {arrow}{delta.pct}% vs last wk
    </div>
  )
}

export default function OverviewSidebar() {
  const [profile, setProfile] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([client.get('/auth/me'), client.get('/workouts', { params: { limit: 200 } })])
      .then(([meRes, wRes]) => {
        setProfile(meRes.data)
        setWorkouts(wRes.data)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load overview.')))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const { start, end } = getWeekRange(0)
    const { start: lastStart, end: lastEnd } = getWeekRange(-1)
    let weekCount = 0
    let weekVolume = 0
    let lastWeekCount = 0
    let lastWeekVolume = 0
    let allVolume = 0
    let best1RM = 0
    const muscleFocus = {}

    for (const w of workouts) {
      const inWeek = w.workout_date >= start && w.workout_date <= end
      const inLastWeek = w.workout_date >= lastStart && w.workout_date <= lastEnd
      if (inWeek) weekCount += 1
      if (inLastWeek) lastWeekCount += 1
      let workoutVolume = 0
      for (const we of w.workout_exercises || []) {
        const muscle = we.exercise?.muscle_group
        if (muscle) muscleFocus[muscle] = (muscleFocus[muscle] || 0) + 1
        for (const s of we.sets || []) {
          if (s.weight_kg && s.reps) {
            workoutVolume += s.weight_kg * s.reps
            const oneRM = s.weight_kg * (1 + s.reps / 30) // Epley formula
            if (oneRM > best1RM) best1RM = oneRM
          }
        }
      }
      allVolume += workoutVolume
      if (inWeek) weekVolume += workoutVolume
      if (inLastWeek) lastWeekVolume += workoutVolume
    }

    return {
      weekCount,
      weekVolume: Math.round(weekVolume),
      workoutsDelta: computeDelta(weekCount, lastWeekCount),
      volumeDelta: computeDelta(Math.round(weekVolume), Math.round(lastWeekVolume)),
      sessions: workouts.length,
      allVolume: Math.round(allVolume),
      best1RM: Math.round(best1RM * 100) / 100,
      muscleFocusList: Object.entries(muscleFocus).sort((a, b) => b[1] - a[1]).slice(0, 6),
      lastSession: workouts.length > 0 ? workouts[0] : null,
    }
  }, [workouts])

  if (loading) {
    return (
      <div className="overview-sidebar">
        <div className="card">
          <Spinner label="Loading…" />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="overview-sidebar">
        <div className="card">
          <div className="error-text">{error}</div>
        </div>
      </div>
    )
  }

  const goals = profile?.goals || []

  return (
    <div className="overview-sidebar">
      {goals.length > 0 && (
        <div className="card">
          <div className="meta" style={{ marginBottom: 10 }}>YOUR GOALS</div>
          <div className="category-chips">
            {goals.map((g) => (
              <span key={g} className="chip active">
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="meta" style={{ marginBottom: 10 }}>THIS WEEK</div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div>
            <p className="stat-number" style={{ fontSize: 26 }}>{stats.weekCount}</p>
            <div className="meta">WORKOUTS</div>
            <DeltaLabel delta={stats.workoutsDelta} />
          </div>
          <div>
            <p className="stat-number" style={{ fontSize: 26 }}>{stats.weekVolume} kg</p>
            <div className="meta">VOLUME</div>
            <DeltaLabel delta={stats.volumeDelta} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="meta" style={{ marginBottom: 10 }}>ALL TIME</div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div>
            <p className="stat-number" style={{ fontSize: 26 }}>{stats.sessions}</p>
            <div className="meta">SESSIONS</div>
          </div>
          <div>
            <p className="stat-number" style={{ fontSize: 26 }}>{stats.allVolume} kg</p>
            <div className="meta">TOTAL VOLUME</div>
          </div>
        </div>
        {stats.best1RM > 0 && (
          <p className="meta" style={{ marginTop: 10 }}>
            Best estimated 1RM: <strong style={{ color: 'var(--text)' }}>{stats.best1RM} kg</strong>
          </p>
        )}
      </div>

      {stats.muscleFocusList.length > 0 && (
        <div className="card">
          <div className="meta" style={{ marginBottom: 10 }}>MUSCLE FOCUS</div>
          {stats.muscleFocusList.map(([muscle, count]) => (
            <div key={muscle} className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ textTransform: 'capitalize' }}>{muscle}</span>
              <span className="meta">{count}×</span>
            </div>
          ))}
        </div>
      )}

      {stats.lastSession && (
        <div className="card">
          <div className="meta" style={{ marginBottom: 6 }}>LAST SESSION</div>
          <div>
            {stats.lastSession.title || 'Workout'} · {stats.lastSession.workout_exercises?.length || 0} exercises
          </div>
        </div>
      )}
    </div>
  )
}
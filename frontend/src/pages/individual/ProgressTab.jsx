import { useEffect, useState, useMemo } from 'react'
import client from '../../api/client'
import Spinner from '../../components/Spinner'
import { useCountUp } from '../../hooks/useCountUp'

const PERIODS = [
  { key: 'day', label: 'Day', days: 1 },
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'year', label: 'Year', days: 365 },
]

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
const todayISO = () => new Date().toISOString().slice(0, 10)

export default function ProgressTab() {
  const [period, setPeriod] = useState('week')
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = PERIODS.find((x) => x.key === period)
    setLoading(true)
    setError('')
    client
      .get('/workouts', { params: { from_date: isoDaysAgo(p.days), to_date: todayISO(), limit: 200 } })
      .then((res) => setWorkouts(res.data))
      .catch((err) => setError(err?.response?.data?.detail || 'Could not load progress.'))
      .finally(() => setLoading(false))
  }, [period])

  const stats = useMemo(() => {
    let totalVolume = 0
    const muscleFocus = {}
    const perExercise = {}

    for (const w of workouts) {
      for (const we of w.workout_exercises || []) {
        const name = we.exercise?.name || 'Unknown'
        const muscle = we.exercise?.muscle_group || 'other'
        muscleFocus[muscle] = (muscleFocus[muscle] || 0) + 1

        for (const s of we.sets || []) {
          if (s.weight_kg && s.reps) {
            totalVolume += s.weight_kg * s.reps
            if (!perExercise[name]) perExercise[name] = { best: 0, latest: 0, sets: 0 }
            perExercise[name].sets += 1
            perExercise[name].best = Math.max(perExercise[name].best, s.weight_kg)
            perExercise[name].latest = s.weight_kg
          }
        }
      }
    }

    return {
      sessions: workouts.length,
      totalVolumeKg: Math.round(totalVolume),
      muscleFocusList: Object.entries(muscleFocus).sort((a, b) => b[1] - a[1]),
      exerciseList: Object.entries(perExercise).sort((a, b) => b[1].sets - a[1].sets),
    }
  }, [workouts])

  const animatedSessions = useCountUp(stats.sessions)
  const animatedVolume = useCountUp(stats.totalVolumeKg)

  return (
    <div className="stack">
      <div className="period-tabs">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`chip${period === p.key ? ' active' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <Spinner label="Loading your progress…" />}
      {error && <div className="error-text">{error}</div>}

      {!loading && (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="meta">Sessions</div>
              <p className="stat-number">{Math.round(animatedSessions)}</p>
            </div>
            <div className="card">
              <div className="meta">Volume</div>
              <p className="stat-number">{Math.round(animatedVolume)} kg</p>
            </div>
          </div>

          <div className="card">
            <h3>Muscle focus</h3>
            {stats.muscleFocusList.length === 0 && <p className="empty-state">No data for this period.</p>}
            {stats.muscleFocusList.map(([muscle, count]) => (
              <div key={muscle} className="meta" style={{ marginBottom: 4 }}>
                {muscle} — {count}×
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Per exercise</h3>
            {stats.exerciseList.length === 0 && <p className="empty-state">No data for this period.</p>}
            {stats.exerciseList.map(([name, info]) => (
              <div key={name} className="workout-item">
                <strong>{name}</strong>
                <div className="meta">
                  Best: {info.best} kg · Latest: {info.latest} kg · {info.sets} sets logged
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
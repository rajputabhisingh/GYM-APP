import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import client from '../../api/client'
import Spinner from '../../components/Spinner'
import { useCountUp } from '../../hooks/useCountUp'
import { getErrorMessage } from '../../utils/errorMessage'

const SUB_TABS = [
  { key: 'goals', label: 'Goals' },
  { key: 'trends', label: 'Trends' },
  { key: 'perExercise', label: 'Per exercise' },
]

const TREND_PERIODS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
]

const TREND_METRICS = [
  { key: 'strength', label: 'Strength' },
  { key: 'volume', label: 'Volume' },
  { key: 'consistency', label: 'Consistency' },
]

const WEIGHT_GOALS = new Set(['Lose weight', 'Gain weight'])

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return { key: `${d.getUTCFullYear()}-W${week}`, label: `W${week}` }
}

function getBuckets(period) {
  const now = new Date()
  const buckets = []
  if (period === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      buckets.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) })
    }
  } else if (period === 'week') {
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const { key, label } = isoWeekKey(d)
      buckets.push({ key, label })
    }
  } else if (period === 'month') {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }) })
    }
  } else {
    for (let i = 2; i >= 0; i--) {
      const y = now.getFullYear() - i
      buckets.push({ key: `${y}`, label: `${y}` })
    }
  }
  return buckets
}

function bucketKeyForDate(date, period) {
  if (period === 'day') return date.toISOString().slice(0, 10)
  if (period === 'week') return isoWeekKey(date).key
  if (period === 'month') return `${date.getFullYear()}-${date.getMonth()}`
  return `${date.getFullYear()}`
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e2128', border: '1px solid #2c313a', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <div style={{ color: '#9aa1ac', marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#f0b93e', fontWeight: 600 }}>{payload[0].value}{unit}</div>
    </div>
  )
}

export default function ProgressTab() {
  const [subTab, setSubTab] = useState('goals')
  const [workouts, setWorkouts] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [trendPeriod, setTrendPeriod] = useState('week')
  const [trendMetric, setTrendMetric] = useState('volume')
  const [selectedExerciseId, setSelectedExerciseId] = useState('')

  useEffect(() => {
    Promise.all([
      client.get('/workouts', { params: { limit: 200 } }),
      client.get('/auth/me'),
    ])
      .then(([wRes, meRes]) => {
        setWorkouts(wRes.data)
        setProfile(meRes.data)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load progress.')))
      .finally(() => setLoading(false))
  }, [])

  // ---------- shared: flattened, chronological sets ----------
  const setsChrono = useMemo(() => {
    const rows = []
    for (const w of workouts) {
      for (const we of w.workout_exercises || []) {
        for (const s of we.sets || []) {
          if (s.weight_kg && s.reps) {
            rows.push({
              date: w.workout_date,
              exerciseId: we.exercise_id,
              exerciseName: we.exercise?.name || 'Unknown',
              weight: s.weight_kg,
            })
          }
        }
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [workouts])

  // ---------- Goals sub-tab ----------
  const weekStreak = useMemo(() => {
    if (!workouts.length) return 0
    const weeksWithWorkout = new Set(workouts.map((w) => isoWeekKey(new Date(w.workout_date)).key))
    let streak = 0
    const cursor = new Date()
    while (weeksWithWorkout.has(isoWeekKey(cursor).key)) {
      streak++
      cursor.setDate(cursor.getDate() - 7)
    }
    return streak
  }, [workouts])

  const prCount14d = useMemo(() => {
    const cutoff = isoDaysAgo(14)
    const bestSoFar = {}
    let count = 0
    for (const row of setsChrono) {
      const prev = bestSoFar[row.exerciseId] || 0
      if (row.weight > prev) {
        if (row.date >= cutoff) count++
        bestSoFar[row.exerciseId] = row.weight
      }
    }
    return count
  }, [setsChrono])

  const volume28d = useMemo(() => {
    const cutoff = isoDaysAgo(28)
    let total = 0
    for (const w of workouts) {
      if (w.workout_date < cutoff) continue
      for (const we of w.workout_exercises || []) {
        for (const s of we.sets || []) {
          if (s.weight_kg && s.reps) total += s.weight_kg * s.reps
        }
      }
    }
    return Math.round(total)
  }, [workouts])

  // ---------- Trends sub-tab ----------
  const trendChartData = useMemo(() => {
    const buckets = getBuckets(trendPeriod)
    const bucketMap = Object.fromEntries(
      buckets.map((b) => [b.key, { ...b, volume: 0, maxWeight: 0, sessions: 0 }])
    )
    for (const w of workouts) {
      const key = bucketKeyForDate(new Date(w.workout_date + 'T00:00:00'), trendPeriod)
      if (!bucketMap[key]) continue
      bucketMap[key].sessions += 1
      for (const we of w.workout_exercises || []) {
        for (const s of we.sets || []) {
          if (s.weight_kg && s.reps) {
            bucketMap[key].volume += s.weight_kg * s.reps
            bucketMap[key].maxWeight = Math.max(bucketMap[key].maxWeight, s.weight_kg)
          }
        }
      }
    }
    return buckets.map((b) => {
      const d = bucketMap[b.key]
      const value =
        trendMetric === 'volume' ? Math.round(d.volume) : trendMetric === 'strength' ? d.maxWeight : d.sessions
      return { label: b.label, value }
    })
  }, [workouts, trendPeriod, trendMetric])

  const inViewStats = useMemo(() => {
    const buckets = getBuckets(trendPeriod)
    const keys = new Set(buckets.map((b) => b.key))
    let sessions = 0
    let volume = 0
    for (const w of workouts) {
      const key = bucketKeyForDate(new Date(w.workout_date + 'T00:00:00'), trendPeriod)
      if (!keys.has(key)) continue
      sessions += 1
      for (const we of w.workout_exercises || []) {
        for (const s of we.sets || []) {
          if (s.weight_kg && s.reps) volume += s.weight_kg * s.reps
        }
      }
    }
    return { sessions, volume: Math.round(volume) }
  }, [workouts, trendPeriod])

  // ---------- Per-exercise sub-tab ----------
  const loggedExercises = useMemo(() => {
    const map = {}
    for (const w of workouts) {
      for (const we of w.workout_exercises || []) {
        const id = we.exercise_id
        if (!map[id]) map[id] = { id, name: we.exercise?.name || 'Unknown', count: 0 }
        map[id].count += 1
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [workouts])

  useEffect(() => {
    if (!selectedExerciseId && loggedExercises.length > 0) {
      setSelectedExerciseId(loggedExercises[0].id)
    }
  }, [loggedExercises, selectedExerciseId])

  const exerciseSeries = useMemo(() => {
    if (!selectedExerciseId) return { points: [], latestBest: 0, allTimeBest: 0, sinceFirst: 0, sessions: 0 }
    const bySession = []
    for (const w of workouts) {
      let sessionBest = 0
      let found = false
      for (const we of w.workout_exercises || []) {
        if (we.exercise_id !== selectedExerciseId) continue
        for (const s of we.sets || []) {
          if (s.weight_kg) {
            found = true
            sessionBest = Math.max(sessionBest, s.weight_kg)
          }
        }
      }
      if (found) bySession.push({ date: w.workout_date, best: sessionBest })
    }
    bySession.sort((a, b) => a.date.localeCompare(b.date))
    const allTimeBest = bySession.reduce((m, p) => Math.max(m, p.best), 0)
    const latestBest = bySession.length ? bySession[bySession.length - 1].best : 0
    const firstBest = bySession.length ? bySession[0].best : 0
    return {
      points: bySession.map((p) => ({ label: p.date.slice(5), value: p.best })),
      latestBest,
      allTimeBest,
      sinceFirst: Math.round((latestBest - firstBest) * 10) / 10,
      sessions: bySession.length,
    }
  }, [workouts, selectedExerciseId])

  const animatedVolume28d = useCountUp(volume28d)

  if (loading) return <Spinner label="Loading your progress…" />
  if (error) return <div className="error-text">{error}</div>

  const goals = profile?.goals || []

  return (
    <div className="stack">
      <div className="period-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip${subTab === t.key ? ' active' : ''}`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'goals' && (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="meta">Week streak</div>
              <p className="stat-number">{weekStreak}</p>
            </div>
            <div className="card">
              <div className="meta">PRs (14 days)</div>
              <p className="stat-number">{prCount14d}</p>
            </div>
          </div>

          {goals.length === 0 && (
            <div className="card">
              <p className="empty-state">
                No goals set yet — head to Settings to pick what you're training for.
              </p>
            </div>
          )}

          {goals.map((goal) => (
            <div key={goal} className="card">
              <div className="section-title" style={{ marginBottom: 0 }}>
                <h3>{goal}</h3>
              </div>
              {WEIGHT_GOALS.has(goal) ? (
                <p className="meta">
                  Can't track this from workout logs alone — body weight isn't recorded in the app yet.
                </p>
              ) : (
                <p className="meta">
                  Training volume: <strong style={{ color: 'var(--text)' }}>{Math.round(animatedVolume28d)} kg</strong> (last 28 days)
                </p>
              )}
            </div>
          ))}
        </>
      )}

      {subTab === 'trends' && (
        <>
          <div className="period-tabs">
            {TREND_PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`chip${trendPeriod === p.key ? ' active' : ''}`}
                onClick={() => setTrendPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="period-tabs">
            {TREND_METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`chip${trendMetric === m.key ? ' active' : ''}`}
                onClick={() => setTrendMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="card">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2c313a" vertical={false} />
                  <XAxis dataKey="label" stroke="#9aa1ac" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9aa1ac" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={<ChartTooltip unit={trendMetric === 'volume' ? ' kg' : trendMetric === 'strength' ? ' kg' : ''} />}
                    cursor={{ fill: 'rgba(240,185,62,0.08)' }}
                  />
                  <Bar dataKey="value" fill="#f0b93e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="meta" style={{ textAlign: 'center', marginTop: 8 }}>
              {trendMetric === 'volume' ? 'Total volume' : trendMetric === 'strength' ? 'Heaviest set' : 'Sessions'} per {trendPeriod}
            </p>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="meta">Workouts in view</div>
              <p className="stat-number">{inViewStats.sessions}</p>
            </div>
            <div className="card">
              <div className="meta">Volume in view</div>
              <p className="stat-number">{inViewStats.volume} kg</p>
            </div>
          </div>
        </>
      )}

      {subTab === 'perExercise' && (
        <>
          {loggedExercises.length === 0 ? (
            <div className="card">
              <p className="empty-state">Log a workout first to see per-exercise progress.</p>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Exercise</label>
                <select value={selectedExerciseId} onChange={(e) => setSelectedExerciseId(e.target.value)}>
                  {loggedExercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="card">
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={exerciseSeries.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2c313a" vertical={false} />
                      <XAxis dataKey="label" stroke="#9aa1ac" fontSize={12} tickLine={false} />
                      <YAxis stroke="#9aa1ac" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip unit=" kg" />} cursor={{ stroke: '#2c313a' }} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#f0b93e"
                        strokeWidth={2}
                        dot={{ fill: '#f0b93e', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="meta" style={{ textAlign: 'center', marginTop: 8 }}>Best set per session, kg</p>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="meta">Latest best</div>
                  <p className="stat-number">{exerciseSeries.latestBest} kg</p>
                </div>
                <div className="card">
                  <div className="meta">All-time best</div>
                  <p className="stat-number">{exerciseSeries.allTimeBest} kg</p>
                </div>
                <div className="card">
                  <div className="meta">Since first session</div>
                  <p className="stat-number">{exerciseSeries.sinceFirst > 0 ? '+' : ''}{exerciseSeries.sinceFirst} kg</p>
                </div>
                <div className="card">
                  <div className="meta">Sessions</div>
                  <p className="stat-number">{exerciseSeries.sessions}</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
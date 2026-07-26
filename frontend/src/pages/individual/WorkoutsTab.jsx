import { useEffect, useState, useCallback } from 'react'
import client from '../../api/client'
import NewSessionForm from '../../components/NewSessionForm'
import Spinner from '../../components/Spinner'
import { getErrorMessage } from '../../utils/errorMessage'

function summarize(workout) {
  let sets = 0
  let volume = 0
  for (const we of workout.workout_exercises || []) {
    for (const s of we.sets || []) {
      sets += 1
      if (s.weight_kg && s.reps) volume += s.weight_kg * s.reps
    }
  }
  return {
    exercises: workout.workout_exercises?.length || 0,
    sets,
    volume: Math.round(volume),
  }
}

function dateBadge(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
  }
}

export default function WorkoutsTab({ allExercises, recentExerciseIds, onDataChange }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('list') // 'list' | 'new' | 'edit'
  const [editingWorkout, setEditingWorkout] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await client.get('/workouts', { params: { limit: 100 } })
      setWorkouts(res.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load workouts.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleFinished() {
    setMode('list')
    setEditingWorkout(null)
    load()
    onDataChange?.()
  }

  async function openWorkout(workout) {
    setError('')
    try {
      const res = await client.get(`/workouts/${workout.id}`)
      setEditingWorkout(res.data)
      setMode('edit')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open this workout.'))
    }
  }

  if (mode === 'new') {
    return (
      <NewSessionForm
        allExercises={allExercises}
        recentExerciseIds={recentExerciseIds}
        onFinished={handleFinished}
        onCancel={() => setMode('list')}
      />
    )
  }

  if (mode === 'edit' && editingWorkout) {
    return (
      <NewSessionForm
        allExercises={allExercises}
        recentExerciseIds={recentExerciseIds}
        existingWorkout={editingWorkout}
        onFinished={handleFinished}
        onCancel={() => {
          setMode('list')
          setEditingWorkout(null)
        }}
      />
    )
  }

  return (
    <div className="stack">
      <button type="button" className="btn" onClick={() => setMode('new')}>
        + New Session
      </button>

      <div className="exercise-grid">
        {loading && <Spinner label="Loading your workouts…" />}
        {error && <div className="error-text">{error}</div>}
        {!loading && workouts.length === 0 && (
          <p className="empty-state">No sessions yet — start one above.</p>
        )}

        {workouts.map((w) => {
          const s = summarize(w)
          const badge = dateBadge(w.workout_date)
          return (
            <button key={w.id} type="button" className="card workout-summary-item" onClick={() => openWorkout(w)}>
              <span className="workout-date-badge">
                <strong>{badge.day}</strong>
                <span>{badge.month}</span>
              </span>
              <span className="workout-summary-text">
                <strong>{w.title || 'Untitled session'}</strong>
                <span className="meta">
                  {s.exercises} exercises · {s.sets} sets · {s.volume} kg
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
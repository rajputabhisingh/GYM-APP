import { useEffect, useState, useCallback } from 'react'
import client from '../../api/client'
import NewSessionForm from '../../components/NewSessionForm'
import Spinner from '../../components/Spinner'
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '../../utils/difficulty'

export default function WorkoutsTab({ allExercises, recentExerciseIds, onDataChange }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNewSession, setShowNewSession] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await client.get('/workouts', { params: { limit: 100 } })
      setWorkouts(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not load workouts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleFinished() {
    setShowNewSession(false)
    load()
    onDataChange?.()
  }

  if (showNewSession) {
    return (
      <NewSessionForm
        allExercises={allExercises}
        recentExerciseIds={recentExerciseIds}
        onFinished={handleFinished}
        onCancel={() => setShowNewSession(false)}
      />
    )
  }

  return (
    <div className="stack">
      <button type="button" className="btn" onClick={() => setShowNewSession(true)}>
        + New Session
      </button>

      <div className="card">
        {loading && <Spinner label="Loading your workouts…" />}
        {error && <div className="error-text">{error}</div>}
        {!loading && workouts.length === 0 && (
          <p className="empty-state">No sessions yet — start one above.</p>
        )}

        {workouts.map((w) => (
          <div key={w.id} className="workout-item">
            <strong>{w.title || 'Untitled session'}</strong>
            <div className="meta">{w.workout_date}</div>
            {w.notes && <div className="meta">{w.notes}</div>}
            {w.workout_exercises?.map((we) => (
              <div key={we.id} style={{ marginTop: 10 }}>
                <span className="badge">{we.exercise?.name}</span>
                <div style={{ marginTop: 6 }}>
                  {we.sets?.map((s) => (
                    <div key={s.id} className="meta">
                      Set {s.set_number}: {s.weight_kg ?? '—'} kg × {s.reps ?? '—'} reps
                      {s.difficulty && (
                        <span style={{ color: DIFFICULTY_COLOR[s.difficulty], fontWeight: 600 }}>
                          {' '}· {DIFFICULTY_LABEL[s.difficulty] || s.difficulty}
                        </span>
                      )}
                      {s.notes ? ` — ${s.notes}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
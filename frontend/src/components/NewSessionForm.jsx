import { useState } from 'react'
import client from '../api/client'
import VoiceRecorderButton from './VoiceRecorderButton'
import ExercisePickerModal from './ExercisePickerModal'
import { parseVoiceTranscript, findClosestExercise, suggestExercises } from '../utils/parseVoiceTranscript'

const DIFFICULTIES = [
  { value: 'easy', label: 'easy' },
  { value: 'moderate', label: 'ok' },
  { value: 'hard', label: 'heavy' },
  { value: 'failure', label: 'very heavy' },
]

const todayISO = () => new Date().toISOString().slice(0, 10)

function emptySet(n) {
  return { set_number: n, weight_kg: '', reps: '', difficulty: 'easy', notes: '', done: false }
}

function emptyCard(id) {
  return { cardId: id, exercise: null, sets: [emptySet(1)], lastTime: null, lastHeard: null, suggestions: [] }
}

export default function NewSessionForm({ allExercises, recentExerciseIds, onFinished, onCancel }) {
  const [date, setDate] = useState(todayISO())
  const [cards, setCards] = useState([emptyCard(1)])
  const [notes, setNotes] = useState('')
  const [pickerForCard, setPickerForCard] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function nextCardId() {
    return cards.length ? Math.max(...cards.map((c) => c.cardId)) + 1 : 1
  }

  function addCard() {
    const id = nextCardId()
    setCards((prev) => [...prev, emptyCard(id)])
    setPickerForCard(id)
  }

  function removeCard(cardId) {
    setCards((prev) => prev.filter((c) => c.cardId !== cardId))
  }

  function updateCard(cardId, updater) {
    setCards((prev) => prev.map((c) => (c.cardId === cardId ? updater(c) : c)))
  }

  async function applyExerciseToCard(cardId, exercise) {
    updateCard(cardId, (c) => ({ ...c, exercise, suggestions: [] }))

    // Suggest starting weight/reps from the last time this exercise was logged.
    try {
      const res = await client.get(`/workouts/exercise-history/${exercise.id}`)
      const lastSets = res.data.sets || []
      if (lastSets.length === 0) return

      updateCard(cardId, (c) => {
        const hasRealData = c.sets.some((s) => s.weight_kg !== '' || s.reps !== '')
        if (hasRealData) return { ...c, lastTime: lastSets }
        const prefilled = lastSets.map((s, i) => ({
          set_number: i + 1,
          weight_kg: s.weight_kg ?? '',
          reps: s.reps ?? '',
          difficulty: 'easy',
          notes: '',
          done: false,
        }))
        return { ...c, sets: prefilled, lastTime: lastSets }
      })
    } catch {
      // suggestion is a nice-to-have — ignore failures silently
    }
  }

  async function handlePickExercise(exercise) {
    const cardId = pickerForCard
    setPickerForCard(null)
    await applyExerciseToCard(cardId, exercise)
  }

  function addSetRow(cardId) {
    updateCard(cardId, (c) => ({ ...c, sets: [...c.sets, emptySet(c.sets.length + 1)] }))
  }

  function removeSetRow(cardId, index) {
    updateCard(cardId, (c) => ({
      ...c,
      sets: c.sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, set_number: i + 1 })),
    }))
  }

  function updateSet(cardId, index, field, value) {
    updateCard(cardId, (c) => ({
      ...c,
      sets: c.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }))
  }

  function toggleCardDone(cardId) {
    updateCard(cardId, (c) => {
      const allDone = c.sets.length > 0 && c.sets.every((s) => s.done)
      return { ...c, sets: c.sets.map((s) => ({ ...s, done: !allDone })) }
    })
  }

  function handleVoiceChunk(cardId, chunkText) {
    const { exerciseGuess, sets: parsedSets } = parseVoiceTranscript(chunkText)

    updateCard(cardId, (c) => {
      let next = { ...c, lastHeard: chunkText, suggestions: [] }

      if (!next.exercise && exerciseGuess) {
        const match = findClosestExercise(exerciseGuess, allExercises)
        if (match) {
          next = { ...next, exercise: match }
        } else {
          next = { ...next, suggestions: suggestExercises(exerciseGuess, allExercises, 4) }
        }
      }

      if (parsedSets.length > 0) {
        const hasRealData = next.sets.some((s) => s.weight_kg !== '' || s.reps !== '')
        const baseCount = hasRealData ? next.sets.length : 0
        const newSets = parsedSets.map((s, i) => ({
          set_number: baseCount + i + 1,
          weight_kg: s.weight_kg ?? '',
          reps: s.reps ?? '',
          difficulty: s.difficulty || 'easy',
          notes: s.notes || '',
          done: false,
        }))
        // First real chunk replaces the single empty placeholder row;
        // every chunk after that appends new sets instead of overwriting.
        next = { ...next, sets: hasRealData ? [...next.sets, ...newSets] : newSets }
      }

      return next
    })
  }

  async function handleFinish() {
    setError('')
    const usable = cards.filter(
      (c) => c.exercise && c.sets.some((s) => s.weight_kg !== '' || s.reps !== '')
    )
    if (usable.length === 0) {
      setError('Add at least one exercise with a set before finishing.')
      return
    }
    setSubmitting(true)
    try {
      const muscleGroups = [...new Set(usable.map((c) => c.exercise.muscle_group))]
      const title = muscleGroups.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(' + ')

      const workoutRes = await client.post('/workouts', {
        workout_date: date,
        title,
        notes: notes || null,
        source: 'manual',
      })
      const workoutId = workoutRes.data.id

      for (let i = 0; i < usable.length; i++) {
        const c = usable[i]
        await client.post(`/workouts/${workoutId}/exercises`, {
          exercise_id: c.exercise.id,
          exercise_order: i + 1,
          sets: c.sets
            .filter((s) => s.weight_kg !== '' || s.reps !== '')
            .map((s) => ({
              set_number: s.set_number,
              weight_kg: s.weight_kg === '' ? null : Number(s.weight_kg),
              reps: s.reps === '' ? null : Number(s.reps),
              difficulty: s.difficulty,
              notes: s.notes || null,
            })),
        })
      }

      onFinished()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not save session.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="session-form">
      <div className="session-header">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <h2>New Session</h2>
        <button type="button" className="btn" onClick={handleFinish} disabled={submitting}>
          {submitting ? 'Saving…' : 'Finish'}
        </button>
      </div>

      <div className="field">
        <label>Date</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="exercise-grid">
        {cards.map((card, idx) => (
          <div key={card.cardId} className="card exercise-card">
            <div className="exercise-card-header">
              <button
                type="button"
                className="exercise-name-btn"
                onClick={() => setPickerForCard(card.cardId)}
              >
                {card.exercise ? card.exercise.name : `Exercise ${idx + 1}`}
              </button>
              <VoiceRecorderButton onChunk={(t) => handleVoiceChunk(card.cardId, t)} />
              <button
                type="button"
                className={`btn btn-ghost done-btn${
                  card.sets.length > 0 && card.sets.every((s) => s.done) ? ' done' : ''
                }`}
                onClick={() => toggleCardDone(card.cardId)}
                aria-label="Mark whole exercise as done"
                title="Mark all sets in this exercise as done"
              >
                {card.sets.length > 0 && card.sets.every((s) => s.done) ? '✓ Done' : 'Done'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPickerForCard(card.cardId)}
                aria-label="Search exercise"
              >
                🔍
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => removeCard(card.cardId)}
                aria-label="Remove exercise"
              >
                ✕
              </button>
            </div>

            {card.lastTime && (
              <p className="meta" style={{ marginBottom: 10 }}>
                Last time: {card.lastTime.map((s) => `${s.weight_kg ?? '—'}kg×${s.reps ?? '—'}`).join(', ')}
                {' — pre-filled below, adjust as needed'}
              </p>
            )}

            {card.lastHeard && !card.exercise && (
              <div className="voice-hint">
                <p className="meta">Heard: "{card.lastHeard}"</p>
                {card.suggestions?.length > 0 ? (
                  <>
                    <p className="meta" style={{ marginTop: 6 }}>Did you mean:</p>
                    <div className="category-chips" style={{ marginTop: 6 }}>
                      {card.suggestions.map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          className="chip"
                          onClick={() => applyExerciseToCard(card.cardId, ex)}
                        >
                          {ex.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="meta" style={{ marginTop: 6 }}>
                    No close match — tap 🔍 to search manually.
                  </p>
                )}
              </div>
            )}

            {card.sets.map((s, i) => (
              <div key={i} className={`set-block${s.done ? ' is-done' : ''}`}>
                <div className="set-row">
                  <span className="set-num">{s.set_number}</span>
                  <input
                    className="input"
                    type="number"
                    step="0.5"
                    placeholder="weight"
                    value={s.weight_kg}
                    disabled={s.done}
                    onChange={(e) => updateSet(card.cardId, i, 'weight_kg', e.target.value)}
                  />
                  <span className="meta">kg ×</span>
                  <input
                    className="input"
                    type="number"
                    placeholder="reps"
                    value={s.reps}
                    disabled={s.done}
                    onChange={(e) => updateSet(card.cardId, i, 'reps', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => removeSetRow(card.cardId, i)}
                    disabled={card.sets.length === 1}
                    aria-label="Remove set"
                  >
                    −
                  </button>
                </div>
                <div className="difficulty-chips">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      disabled={s.done}
                      className={`chip${s.difficulty === d.value ? ' active' : ''}`}
                      onClick={() => updateSet(card.cardId, i, 'difficulty', d.value)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%' }}
              onClick={() => addSetRow(card.cardId)}
            >
              + Set
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={addCard}>
        + Exercise
      </button>

      <div className="field" style={{ marginTop: 18 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Session notes
          <VoiceRecorderButton onChunk={(t) => setNotes((prev) => (prev ? prev + ' ' + t : t))} />
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cardio, aches, anything worth remembering"
        />
      </div>

      {pickerForCard && (
        <ExercisePickerModal
          recentIds={recentExerciseIds}
          onSelect={handlePickExercise}
          onClose={() => setPickerForCard(null)}
        />
      )}
    </div>
  )
}
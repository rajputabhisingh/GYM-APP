import { useState, useRef, useEffect } from 'react'
import client from '../api/client'
import VoiceRecorderButton from './VoiceRecorderButton'
import ExercisePickerModal from './ExercisePickerModal'
import MuscleBadge from './MuscleBadge'
import { parseVoiceTranscript, findClosestExercise, suggestExercises } from '../utils/parseVoiceTranscript'
import { DIFFICULTIES, kgToLbs, lbsToKg } from '../utils/difficulty'
import { getErrorMessage } from '../utils/errorMessage'

const todayISO = () => new Date().toISOString().slice(0, 10)

function emptySet(n) {
  return { set_number: n, weight_kg: '', reps: '', difficulty: 'easy', notes: '', done: false, per_side: false }
}

export default function NewSessionForm({ allExercises, recentExerciseIds, existingWorkout, onFinished, onCancel }) {
  const nextIdRef = useRef(1)
  function nextCardId() {
    return `new-${nextIdRef.current++}`
  }

  function makeEmptyCard() {
    return {
      cardId: nextCardId(),
      exercise: null,
      sets: [emptySet(1)],
      lastTime: null,
      best: null,
      average: null,
      target: null,
      showTargetForm: false,
      lastHeard: null,
      suggestions: [],
      unit: 'kg',
    }
  }

  function cardFromExisting(we) {
    return {
      cardId: we.id,
      exercise: we.exercise,
      sets:
        we.sets && we.sets.length > 0
          ? we.sets.map((s) => ({
              set_number: s.set_number,
              weight_kg: s.weight_kg ?? '',
              reps: s.reps ?? '',
              difficulty: s.difficulty || 'easy',
              notes: s.notes || '',
              done: false,
              per_side: s.per_side || false,
            }))
          : [emptySet(1)],
      lastTime: null,
      best: null,
      average: null,
      target: null,
      showTargetForm: false,
      lastHeard: null,
      suggestions: [],
      unit: 'kg',
    }
  }

  const [date, setDate] = useState(existingWorkout?.workout_date || todayISO())
  const [cards, setCards] = useState(() =>
    existingWorkout?.workout_exercises?.length
      ? existingWorkout.workout_exercises.map(cardFromExisting)
      : [makeEmptyCard()]
  )
  const [notes, setNotes] = useState(existingWorkout?.notes || '')
  const [pickerForCard, setPickerForCard] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (existingWorkout) {
      for (const c of cards) {
        if (c.exercise) loadExerciseHistory(c.cardId, c.exercise)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addCard() {
    const card = makeEmptyCard()
    setCards((prev) => [...prev, card])
    setPickerForCard(card.cardId)
  }

  function removeCard(cardId) {
    setCards((prev) => prev.filter((c) => c.cardId !== cardId))
  }

  function updateCard(cardId, updater) {
    setCards((prev) => prev.map((c) => (c.cardId === cardId ? updater(c) : c)))
  }

  function toggleUnit(cardId) {
    updateCard(cardId, (c) => {
      const nextUnit = c.unit === 'kg' ? 'lbs' : 'kg'
      const sets = c.sets.map((s) => {
        if (s.weight_kg === '' || s.weight_kg == null) return s
        const num = Number(s.weight_kg)
        const converted = nextUnit === 'lbs' ? kgToLbs(num) : lbsToKg(num)
        return { ...s, weight_kg: converted }
      })
      return { ...c, unit: nextUnit, sets }
    })
  }

  function toggleSide(cardId, index) {
    updateCard(cardId, (c) => ({
      ...c,
      sets: c.sets.map((s, i) => (i === index ? { ...s, per_side: !s.per_side } : s)),
    }))
  }

  function toggleTargetForm(cardId) {
    updateCard(cardId, (c) => ({ ...c, showTargetForm: !c.showTargetForm }))
  }

  function setTargetField(cardId, field, value) {
    updateCard(cardId, (c) => ({ ...c, target: { ...(c.target || {}), [field]: value } }))
  }

  function saveTarget(cardId) {
    updateCard(cardId, (c) => ({ ...c, showTargetForm: false }))
  }

  async function loadExerciseHistory(cardId, exercise) {
    try {
      const res = await client.get(`/workouts/exercise-history/${exercise.id}`)
      const lastSets = res.data.sets || []
      const best = res.data.best || null
      const average = res.data.average || null

      updateCard(cardId, (c) => {
        let next = { ...c, best, average }
        if (lastSets.length === 0) return next

        const hasRealData = c.sets.some((s) => s.weight_kg !== '' || s.reps !== '')
        if (hasRealData) return { ...next, lastTime: lastSets }

        const prefilled = lastSets.map((s, i) => ({
          set_number: i + 1,
          weight_kg: s.weight_kg == null ? '' : c.unit === 'lbs' ? kgToLbs(s.weight_kg) : s.weight_kg,
          reps: s.reps ?? '',
          difficulty: 'easy',
          notes: '',
          done: false,
          per_side: s.per_side || false,
        }))
        return { ...next, sets: prefilled, lastTime: lastSets }
      })
    } catch {
      // history/suggestion is a nice-to-have — ignore failures silently
    }
  }

  async function applyExerciseToCard(cardId, exercise) {
    updateCard(cardId, (c) => ({ ...c, exercise, suggestions: [] }))
    await loadExerciseHistory(cardId, exercise)
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

  function handleVoiceChunk(cardId, transcripts) {
    const primary = transcripts[0]
    const { exerciseGuess, sets: parsedSets } = parseVoiceTranscript(primary)
    let newlyMatched = null

    updateCard(cardId, (c) => {
      let next = { ...c, lastHeard: primary, suggestions: [] }

      if (!next.exercise && exerciseGuess) {
        let match = null
        for (const alt of transcripts) {
          const altGuess = parseVoiceTranscript(alt).exerciseGuess
          match = findClosestExercise(altGuess, allExercises)
          if (match) break
        }
        if (match) {
          next = { ...next, exercise: match }
          newlyMatched = match
        } else {
          next = { ...next, suggestions: suggestExercises(exerciseGuess, allExercises, 4) }
        }
      }

      if (parsedSets.length > 0) {
        const hasRealData = next.sets.some((s) => s.weight_kg !== '' || s.reps !== '')
        const baseCount = hasRealData ? next.sets.length : 0
        const newSets = parsedSets.map((s, i) => ({
          set_number: baseCount + i + 1,
          weight_kg: s.weight_kg == null ? '' : next.unit === 'lbs' ? kgToLbs(s.weight_kg) : s.weight_kg,
          reps: s.reps ?? '',
          difficulty: s.difficulty || 'easy',
          notes: s.notes || '',
          done: false,
          per_side: false,
        }))
        next = { ...next, sets: hasRealData ? [...next.sets, ...newSets] : newSets }
      }

      return next
    })

    if (newlyMatched) loadExerciseHistory(cardId, newlyMatched)
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

      let workoutId
      if (existingWorkout) {
        workoutId = existingWorkout.id
        await client.patch(`/workouts/${workoutId}`, { workout_date: date, title, notes: notes || null })
        await client.delete(`/workouts/${workoutId}/exercises`)
      } else {
        const workoutRes = await client.post('/workouts', {
          workout_date: date,
          title,
          notes: notes || null,
          source: 'manual',
        })
        workoutId = workoutRes.data.id
      }

      for (let i = 0; i < usable.length; i++) {
        const c = usable[i]
        await client.post(`/workouts/${workoutId}/exercises`, {
          exercise_id: c.exercise.id,
          exercise_order: i + 1,
          sets: c.sets
            .filter((s) => s.weight_kg !== '' || s.reps !== '')
            .map((s) => {
              const rawWeight = s.weight_kg === '' ? null : Number(s.weight_kg)
              const weightKg = rawWeight == null ? null : c.unit === 'lbs' ? lbsToKg(rawWeight) : rawWeight
              return {
                set_number: s.set_number,
                weight_kg: weightKg,
                reps: s.reps === '' ? null : Number(s.reps),
                difficulty: s.difficulty,
                notes: s.notes || null,
                per_side: s.per_side,
              }
            }),
        })
      }

      onFinished()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save session.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!existingWorkout) return
    if (!window.confirm('Delete this whole workout? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    try {
      await client.delete(`/workouts/${existingWorkout.id}`)
      onFinished()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete workout.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="session-form">
      <div className="session-header">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <h2>{existingWorkout ? 'Edit Session' : 'New Session'}</h2>
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
              {card.exercise && <MuscleBadge muscleGroup={card.exercise.muscle_group} />}
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

            {(card.best || card.average || card.lastTime) && (
              <div style={{ marginBottom: 10 }}>
                {(card.best || card.average) && (
                  <p className="meta">
                    {card.best && (
                      <>🏆 Best: <strong style={{ color: 'var(--text)' }}>{card.best.weight_kg}kg×{card.best.reps}</strong></>
                    )}
                    {card.average && <> · avg {card.average.weight_kg}kg×{card.average.reps} reps</>}
                  </p>
                )}
                {card.lastTime && (
                  <p className="meta">
                    Last time: {card.lastTime.map((s) => `${s.weight_kg ?? '—'}kg×${s.reps ?? '—'}`).join(', ')}
                  </p>
                )}
              </div>
            )}

            {card.exercise && (
              <div style={{ marginBottom: 10 }}>
                {!card.showTargetForm && !card.target && (
                  <button type="button" className="btn btn-ghost" onClick={() => toggleTargetForm(card.cardId)}>
                    + Set target
                  </button>
                )}
                {!card.showTargetForm && card.target && (
                  <p className="meta">
                    🎯 Target: <strong style={{ color: 'var(--text)' }}>{card.target.weight || '—'}kg × {card.target.reps || '—'}</strong>{' '}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => toggleTargetForm(card.cardId)}
                    >
                      edit
                    </button>
                  </p>
                )}
                {card.showTargetForm && (
                  <div className="voice-hint" style={{ marginBottom: 0 }}>
                    <div className="row">
                      <input
                        className="input"
                        type="number"
                        placeholder="target kg"
                        value={card.target?.weight || ''}
                        onChange={(e) => setTargetField(card.cardId, 'weight', e.target.value)}
                      />
                      <input
                        className="input"
                        type="number"
                        placeholder="target reps"
                        value={card.target?.reps || ''}
                        onChange={(e) => setTargetField(card.cardId, 'reps', e.target.value)}
                      />
                      <button type="button" className="btn" onClick={() => saveTarget(card.cardId)}>
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                  <button
                    type="button"
                    className="unit-toggle"
                    onClick={() => toggleUnit(card.cardId)}
                    disabled={s.done}
                    title="Tap to switch kg / lbs"
                  >
                    {card.unit} ×
                  </button>
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
                    className={`unit-toggle${s.per_side ? ' active-side' : ''}`}
                    onClick={() => toggleSide(card.cardId, i)}
                    disabled={s.done}
                    title="Reps per side (unilateral) vs total"
                  >
                    /side
                  </button>
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
                  {DIFFICULTIES.map((d) => {
                    const isActive = s.difficulty === d.value
                    return (
                      <button
                        key={d.value}
                        type="button"
                        disabled={s.done}
                        className={`chip${isActive ? ' active' : ''}`}
                        style={isActive ? { background: d.color, borderColor: d.color, color: '#0e1410' } : undefined}
                        onClick={() => updateSet(card.cardId, i, 'difficulty', d.value)}
                      >
                        {d.label}
                      </button>
                    )
                  })}
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
          <VoiceRecorderButton onChunk={(alts) => setNotes((prev) => (prev ? prev + ' ' + alts[0] : alts[0]))} />
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cardio, aches, anything worth remembering"
        />
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        {existingWorkout && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', flex: 'none' }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete workout'}
          </button>
        )}
        <button type="button" className="btn" onClick={handleFinish} disabled={submitting} style={{ flex: 1 }}>
          {submitting ? 'Saving…' : 'Finish workout'}
        </button>
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
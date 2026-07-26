import { useState, useEffect, useMemo } from 'react'
import client from '../api/client'
import MuscleBadge from './MuscleBadge'

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'legs', label: 'Legs' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'forearms', label: 'Forearms' },
  { key: 'core', label: 'Core' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'cardio', label: 'Cardio' },
]

export default function ExercisePickerModal({ recentIds = [], onSelect, onClose }) {
  const [all, setAll] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client
      .get('/exercises')
      .then((res) => setAll(res.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = all
    if (category !== 'all') list = list.filter((e) => e.muscle_group === category)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((e) => e.name.toLowerCase().includes(q))
    }
    return list
  }, [all, category, query])

  const showRecent = !query.trim() && category === 'all'
  const recent = useMemo(() => {
    if (!showRecent) return []
    return recentIds.map((id) => all.find((e) => e.id === id)).filter(Boolean).slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentIds, all, showRecent])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <input
            className="input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
          />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="category-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip${category === c.key ? ' active' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="modal-list">
          {loading && <p className="empty-state">Loading…</p>}

          {!loading && recent.length > 0 && (
            <>
              <div className="modal-list-heading">Recently used</div>
              {recent.map((ex) => (
                <button key={ex.id} type="button" className="modal-list-item" onClick={() => onSelect(ex)}>
                  <MuscleBadge muscleGroup={ex.muscle_group} />
                  <span>{ex.name}</span>
                </button>
              ))}
              <div className="modal-list-heading">All exercises</div>
            </>
          )}

          {!loading &&
            filtered.map((ex) => (
              <button key={ex.id} type="button" className="modal-list-item" onClick={() => onSelect(ex)}>
                <MuscleBadge muscleGroup={ex.muscle_group} />
                <span>{ex.name}</span>
              </button>
            ))}

          {!loading && filtered.length === 0 && <p className="empty-state">No exercises found.</p>}

          {!loading && !query.trim() && category === 'all' && (
            <p className="meta" style={{ textAlign: 'center', marginTop: 14 }}>
              {all.length} exercises available — search above, or pick a muscle group to browse.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
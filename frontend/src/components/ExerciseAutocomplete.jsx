import { useState, useEffect, useMemo } from 'react'
import client from '../api/client'

export default function ExerciseAutocomplete({ value, recentIds = [], onSelect }) {
  const [query, setQuery] = useState(value?.name || '')
  const [all, setAll] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    client.get('/exercises').then((res) => setAll(res.data))
  }, [])

  useEffect(() => {
    setQuery(value?.name || '')
  }, [value])

  const filtered = useMemo(() => {
    if (!query.trim()) return all
    const q = query.toLowerCase()
    return all.filter((e) => e.name.toLowerCase().includes(q))
  }, [all, query])

  const showRecent = !query.trim() || query === value?.name
  const recent = useMemo(() => {
    if (!showRecent) return []
    return recentIds.map((id) => all.find((e) => e.id === id)).filter(Boolean).slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentIds, all, showRecent])

  function handleSelect(ex) {
    onSelect(ex)
    setQuery(ex.name)
    setOpen(false)
  }

  function handleChange(e) {
    setQuery(e.target.value)
    setOpen(true)
    if (value) onSelect(null)
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        className="input"
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search exercise…"
      />
      {open && (
        <div className="gym-picker-results">
          {showRecent && recent.length > 0 && (
            <>
              <div className="modal-list-heading" style={{ margin: '8px 12px 4px' }}>
                Recently used
              </div>
              {recent.map((ex) => (
                <div key={ex.id} className="gym-picker-item" onMouseDown={() => handleSelect(ex)}>
                  {ex.name}
                </div>
              ))}
              <div className="modal-list-heading" style={{ margin: '8px 12px 4px' }}>
                All exercises
              </div>
            </>
          )}
          {filtered.map((ex) => (
            <div key={ex.id} className="gym-picker-item" onMouseDown={() => handleSelect(ex)}>
              {ex.name}
            </div>
          ))}
          {filtered.length === 0 && <div className="gym-picker-item muted">No exercises found</div>}
        </div>
      )}
    </div>
  )
}
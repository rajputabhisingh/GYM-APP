import { useState, useEffect, useRef } from 'react'
import client from '../api/client'

export default function GymPicker({ value, onSelect, required = true }) {
  const [query, setQuery] = useState(value?.gym_name || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!query || (value && query === value.gym_name)) {
      setResults([])
      return
    }
    setLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await client.get('/gyms/search', { params: { q: query } })
        setResults(res.data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function handleSelect(gym) {
    onSelect(gym)
    setQuery(gym.gym_name)
    setOpen(false)
    setResults([])
  }

  function handleChange(e) {
    setQuery(e.target.value)
    setOpen(true)
    if (value) onSelect(null)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        required={required}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by gym name or Gym Code"
      />
      {open && (loading || results.length > 0 || query.length > 1) && (
        <div className="gym-picker-results">
          {loading && <div className="gym-picker-item muted">Searching…</div>}
          {!loading &&
            results.map((g) => (
              <div key={g.id} className="gym-picker-item" onMouseDown={() => handleSelect(g)}>
                <strong>{g.gym_name}</strong>
                <span className="meta"> · {g.gym_code}</span>
              </div>
            ))}
          {!loading && results.length === 0 && query.length > 1 && (
            <div className="gym-picker-item muted">No gyms found</div>
          )}
        </div>
      )}
      {value && (
        <p className="success-text" style={{ marginTop: 6 }}>
          Selected: {value.gym_name} ({value.gym_code})
        </p>
      )}
    </div>
  )
}
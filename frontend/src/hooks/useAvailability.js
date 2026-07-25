import { useState, useEffect, useRef } from 'react'
import client from '../api/client'

/** status: null | 'checking' | 'available' | 'taken' */
export function useAvailability(field, value, minLength = 3) {
  const [status, setStatus] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!value || value.length < minLength) {
      setStatus(null)
      return
    }
    setStatus('checking')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await client.get('/auth/check-availability', { params: { field, value } })
        setStatus(res.data.available ? 'available' : 'taken')
      } catch {
        setStatus(null)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [field, value, minLength])

  return status
}
import { useEffect, useRef, useState, useCallback } from 'react'

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

const ERROR_MESSAGES = {
  'not-allowed': 'Mic permission denied — click the lock/site icon in the address bar and allow microphone.',
  'no-speech': 'No speech detected — try again.',
  network: 'Network error — check your internet connection.',
  'audio-capture': 'No microphone found on this device.',
}

export default function VoiceRecorderButton({ onChunk }) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-IN'

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const chunk = event.results[i][0].transcript.trim()
          if (chunk) onChunk(chunk)
        }
      }
    }

    recognition.onerror = (event) => {
      setError(ERROR_MESSAGES[event.error] || `Error: ${event.error}`)
      setRecording(false)
    }

    // Chrome sometimes ends the session on its own after a pause in speech —
    // that's fine, the button just goes back to idle; tap again to resume.
    recognition.onend = () => setRecording(false)

    recognitionRef.current = recognition
    return () => {
      try {
        recognition.abort()
      } catch {
        /* already stopped */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) {
      setError('Speech recognition not available in this browser.')
      return
    }
    setError('')
    if (recording) {
      recognition.stop()
      setRecording(false)
    } else {
      try {
        recognition.start()
        setRecording(true)
      } catch (e) {
        setError('Could not start microphone: ' + (e?.message || 'unknown error'))
      }
    }
  }, [recording])

  if (!SpeechRecognitionAPI) {
    return <span className="meta">Voice needs Chrome/Edge</span>
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={`btn btn-ghost mic-btn-sm${recording ? ' recording' : ''}`}
        onClick={toggle}
        aria-label={recording ? 'Stop recording' : 'Record exercise by voice'}
        title={recording ? 'Listening… tap to stop' : 'Record exercise by voice'}
      >
        {recording ? '⏹' : '🎤'}
      </button>
      {(recording || error) && (
        <span
          className={error ? 'error-text' : 'meta'}
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            minWidth: 180,
            textAlign: 'right',
            fontSize: 11,
            zIndex: 5,
          }}
        >
          {error || 'Listening…'}
        </span>
      )}
    </span>
  )
}
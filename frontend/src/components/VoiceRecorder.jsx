import { useEffect, useRef, useState, useCallback } from 'react'

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export default function VoiceRecorder({ onTranscriptReady }) {
  const [recording, setRecording] = useState(false)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!SpeechRecognitionAPI) return
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-IN'

    recognition.onresult = (event) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) finalChunk += text + ' '
        else interimChunk += text
      }
      if (finalChunk) setFinalText((prev) => (prev + ' ' + finalChunk).trim())
      setInterimText(interimChunk)
    }

    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)

    recognitionRef.current = recognition
    return () => recognition.stop()
  }, [])

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return
    if (recording) {
      recognitionRef.current.stop()
      setRecording(false)
    } else {
      setFinalText('')
      setInterimText('')
      recognitionRef.current.start()
      setRecording(true)
    }
  }, [recording])

  function handleUseTranscript() {
    if (finalText.trim() && onTranscriptReady) onTranscriptReady(finalText.trim())
  }

  if (!SpeechRecognitionAPI) {
    return (
      <div className="voice-box">
        <p className="empty-state">
          Voice input needs Chrome or Edge — try manual entry on this browser instead.
        </p>
      </div>
    )
  }

  const displayText = [finalText, interimText].filter(Boolean).join(' ')

  return (
    <div className="voice-box">
      <button
        type="button"
        className={`mic-btn${recording ? ' recording' : ''}`}
        onClick={toggleRecording}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
      >
        {recording ? '■' : '🎤'}
      </button>
      <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
        {recording ? 'Listening… speak your workout' : 'Tap to record your workout'}
      </p>

      <div className={`transcript-box${displayText ? '' : ' placeholder'}`}>
        {displayText || 'e.g. "Flat bench press, 22.5 kilos for 10 reps, easy."'}
      </div>

      {finalText.trim() && !recording && (
        <button type="button" className="btn" style={{ marginTop: 12 }} onClick={handleUseTranscript}>
          Use as workout notes
        </button>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GymPicker from '../components/GymPicker'
import PasswordStrength from '../components/PasswordStrength'
import { useAvailability } from '../hooks/useAvailability'
import { getErrorMessage } from '../utils/errorMessage'

const initialForm = {
  full_name: '',
  workout_type: 'free',
  phone: '',
  email: '',
  username: '',
  password: '',
  promo_code: '',
}

export default function IndividualSignup() {
  const { signupIndividual, resendVerification } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(initialForm)
  const [gym, setGym] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  const usernameStatus = useAvailability('username', form.username)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleWorkoutTypeChange(value) {
    update('workout_type', value)
    setGym(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        promo_code: form.promo_code || null,
        gym_code: form.workout_type === 'in_gym' && gym ? gym.gym_code : null,
      }
      const res = await signupIndividual(payload)
      setSuccess(res.message)
      setNeedsVerification(!res.verified)
      if (res.verified) setTimeout(() => navigate('/login'), 1800)
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please check your details.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setResendMsg('')
    try {
      await resendVerification(form.email)
      setResendMsg('Verification email resent — check your inbox.')
    } catch (err) {
      setResendMsg(getErrorMessage(err, 'Could not resend email.'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <h1>
          Track <span className="accent">your way.</span>
        </h1>
        <p>Home workouts or gym sessions — MotionX adapts to how you train.</p>
      </div>
      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit} style={{ maxWidth: 440 }}>
          <h2>Individual Sign Up</h2>
          <p className="subtitle">All fields are required unless marked optional.</p>

          <div className="field">
            <label>Full name</label>
            <input
              className="input"
              required
              minLength={2}
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="field">
            <label>Workout type</label>
            <select value={form.workout_type} onChange={(e) => handleWorkoutTypeChange(e.target.value)}>
              <option value="free">Free Workout</option>
              <option value="in_gym">In-Gym</option>
            </select>
          </div>

          {form.workout_type === 'in_gym' && (
            <div className="field">
              <label>Gym (optional — you can add this later)</label>
              <GymPicker value={gym} onSelect={setGym} required={false} />
            </div>
          )}

          <div className="row">
            <div className="field">
              <label>Phone number</label>
              <input
                className="input"
                required
                minLength={10}
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="9876543210"
              />
            </div>
            <div className="field">
              <label>Email address</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="field">
            <label>
              Username
              {usernameStatus === 'checking' && <span className="field-status meta">checking…</span>}
              {usernameStatus === 'available' && <span className="field-status success-text">available</span>}
              {usernameStatus === 'taken' && <span className="field-status error-text">already taken</span>}
            </label>
            <input
              className="input"
              required
              minLength={3}
              pattern="[a-zA-Z0-9_.]+"
              title="Letters, numbers, underscore, dot only"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              placeholder="username"
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="At least 6 characters"
            />
            <PasswordStrength password={form.password} />
          </div>

          <div className="field">
            <label>Promo code (optional)</label>
            <input
              className="input"
              value={form.promo_code}
              onChange={(e) => update('promo_code', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Registering…' : 'Create account'}
          </button>

          {error && <div className="error-text">{error}</div>}
          {success && <div className="success-text">{success}</div>}

          {needsVerification && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={handleResend} disabled={resending}>
                {resending ? 'Resending…' : 'Resend verification email'}
              </button>
              {resendMsg && <p className="meta" style={{ marginTop: 6 }}>{resendMsg}</p>}
            </div>
          )}

          <div className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
            <br />
            Wrong role? <Link to="/signup">Back to sign up options</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
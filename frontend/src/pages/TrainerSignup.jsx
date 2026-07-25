import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GymPicker from '../components/GymPicker'
import PasswordStrength from '../components/PasswordStrength'
import { useAvailability } from '../hooks/useAvailability'

const initialForm = {
  full_name: '',
  trainer_type: 'freelancer',
  phone: '',
  email: '',
  pin_code: '',
  username: '',
  password: '',
  promo_code: '',
}

export default function TrainerSignup() {
  const { signupTrainer, resendVerification } = useAuth()
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

  function handleTrainerTypeChange(value) {
    update('trainer_type', value)
    setGym(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (form.trainer_type === 'in_gym' && !gym) {
      setError('Please select your gym from the search results.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        promo_code: form.promo_code || null,
        gym_code: form.trainer_type === 'in_gym' ? gym.gym_code : null,
      }
      const res = await signupTrainer(payload)
      setSuccess(res.message)
      setNeedsVerification(!res.verified)
      if (res.verified) setTimeout(() => navigate('/login'), 1800)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed. Please check your details.')
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
      setResendMsg(err?.response?.data?.detail || 'Could not resend email.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <h1>
          Coach with <span className="accent">MotionX.</span>
        </h1>
        <p>Freelance or work at a gym — manage your clients' progress in one place.</p>
      </div>
      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit} style={{ maxWidth: 440 }}>
          <h2>Trainer Sign Up</h2>
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
            <label>Trainer type</label>
            <select value={form.trainer_type} onChange={(e) => handleTrainerTypeChange(e.target.value)}>
              <option value="freelancer">Freelancer</option>
              <option value="in_gym">In-Gym</option>
            </select>
          </div>

          {form.trainer_type === 'in_gym' && (
            <div className="field">
              <label>Gym</label>
              <GymPicker value={gym} onSelect={setGym} />
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
            <label>PIN code</label>
            <input
              className="input"
              required
              pattern="[0-9]{6}"
              title="6-digit PIN code"
              value={form.pin_code}
              onChange={(e) => update('pin_code', e.target.value)}
              placeholder="560001"
            />
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
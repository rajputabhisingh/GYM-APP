import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const initialForm = {
  gym_name: '',
  owner_name: '',
  phone: '',
  email: '',
  address: '',
  pin_code: '',
  username: '',
  password: '',
  promo_code: '',
}

export default function OwnerSignup() {
  const { signupOwner } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const payload = { ...form, promo_code: form.promo_code || null }
      const res = await signupOwner(payload)
      setSuccess(res.message || 'Registration successful. Check your email to verify your account.')
      setTimeout(() => navigate('/login'), 2200)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed. Please check your details.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <h1>
          Register your <span className="accent">gym.</span>
        </h1>
        <p>
          One registration sets up your gym on MotionX. After email
          verification you'll get a unique Gym Code to bring your trainers
          and staff on board.
        </p>
      </div>
      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit} style={{ maxWidth: 440 }}>
          <h2>Gym Owner Registration</h2>
          <p className="subtitle">All fields are required unless marked optional.</p>

          <div className="field">
            <label>Gym name</label>
            <input
              className="input"
              required
              minLength={2}
              value={form.gym_name}
              onChange={(e) => update('gym_name', e.target.value)}
              placeholder="Iron Peak Fitness"
            />
          </div>

          <div className="field">
            <label>Owner name</label>
            <input
              className="input"
              required
              minLength={2}
              value={form.owner_name}
              onChange={(e) => update('owner_name', e.target.value)}
              placeholder="Prakash Kumar"
            />
          </div>

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
                placeholder="owner@example.com"
              />
            </div>
          </div>

          <div className="field">
            <label>Address</label>
            <input
              className="input"
              required
              minLength={5}
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Street, Area, City, State"
            />
          </div>

          <div className="row">
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
              <label>Username</label>
              <input
                className="input"
                required
                minLength={3}
                pattern="[a-zA-Z0-9_.]+"
                title="Letters, numbers, underscore, dot only"
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                placeholder="ironpeak_owner"
              />
            </div>
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
            {submitting ? 'Registering…' : 'Register gym'}
          </button>

          {error && <div className="error-text">{error}</div>}
          {success && <div className="success-text">{success}</div>}

          <div className="auth-switch">
            Already registered? <Link to="/login">Log in</Link>
            <br />
            Joining an existing gym? <Link to="/signup">Individual / Trainer sign up</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
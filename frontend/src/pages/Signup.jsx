import { Link } from 'react-router-dom'

const OPTIONS = [
  {
    to: '/signup/individual',
    title: 'Individual',
    desc: 'Track your own workouts — at home or in a gym.',
  },
  {
    to: '/signup/trainer',
    title: 'Trainer',
    desc: 'Freelance or work at a gym, manage client progress.',
  },
  {
    to: '/signup/owner',
    title: 'Gym Owner',
    desc: 'Register your gym and get a Gym Code for your team.',
  },
]

export default function Signup() {
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <h1>
          Join <span className="accent">MotionX.</span>
        </h1>
        <p>Pick the account type that fits you.</p>
      </div>
      <div className="auth-form-panel">
        <div className="auth-form" style={{ maxWidth: 420 }}>
          <h2>Sign up</h2>
          <p className="subtitle">All fields are required unless marked optional.</p>

          <div className="stack">
            {OPTIONS.map((o) => (
              <Link
                key={o.to}
                to={o.to}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <h3 style={{ marginBottom: 4 }}>{o.title}</h3>
                <p className="meta" style={{ margin: 0 }}>
                  {o.desc}
                </p>
              </Link>
            ))}
          </div>

          <div className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
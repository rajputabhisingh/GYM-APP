const LEVELS = [
  { label: 'Very weak', color: '#ff5a5a' },
  { label: 'Weak', color: '#ff5a5a' },
  { label: 'Fair', color: '#ffb020' },
  { label: 'Good', color: '#ffd60a' },
  { label: 'Strong', color: '#3ddc84' },
]

function scorePassword(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

export default function PasswordStrength({ password }) {
  if (!password) return null
  const score = scorePassword(password)
  const level = LEVELS[score]

  return (
    <div style={{ marginTop: 8 }}>
      <div className="strength-bar">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="strength-seg"
            style={{ background: i < score ? level.color : undefined }}
          />
        ))}
      </div>
      <span className="meta">{level.label}</span>
    </div>
  )
}
const MUSCLE_STYLE = {
  chest: { label: 'CH', color: '#ff5a5a' },
  back: { label: 'BK', color: '#3d8bfd' },
  shoulders: { label: 'SH', color: '#f0b93e' },
  biceps: { label: 'BI', color: '#a06bff' },
  triceps: { label: 'TR', color: '#a06bff' },
  forearms: { label: 'FA', color: '#a06bff' },
  legs: { label: 'LG', color: '#3ddc84' },
  glutes: { label: 'GL', color: '#3ddc84' },
  core: { label: 'CO', color: '#ff8a3d' },
  cardio: { label: 'CD', color: '#ff5a5a' },
  full_body: { label: 'FB', color: '#9aa1ac' },
}

export default function MuscleBadge({ muscleGroup, size = 28 }) {
  const style = MUSCLE_STYLE[muscleGroup] || { label: '?', color: '#9aa1ac' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${style.color}26`,
        color: style.color,
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {style.label}
    </span>
  )
}
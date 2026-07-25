export const DIFFICULTIES = [
  { value: 'easy', label: 'easy', color: '#3ddc84' },
  { value: 'moderate', label: 'ok', color: '#ffd60a' },
  { value: 'hard', label: 'heavy', color: '#ffb020' },
  { value: 'failure', label: 'very heavy', color: '#ff5a5a' },
]

export const DIFFICULTY_COLOR = Object.fromEntries(DIFFICULTIES.map((d) => [d.value, d.color]))
export const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.value, d.label]))

const LBS_PER_KG = 2.20462

export function kgToLbs(kg) {
  return Math.round(kg * LBS_PER_KG * 100) / 100
}

export function lbsToKg(lbs) {
  return Math.round((lbs / LBS_PER_KG) * 100) / 100
}
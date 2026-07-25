// Extracts sets from a spoken/typed workout description.
// Example input:
// "Flat bench press. 17.5 kilos for 15 reps easy. 20 kilos for 12 reps,
//  last two reps felt heavy. 22.5 kilos for 10 reps, needed support at the end."
//
// Works for both kg and lbs ("kg", "kgs", "kilo(s)", "lb", "lbs", "pound(s)"),
// and both "x" and "for" as the weight-reps connector.

const WEIGHT_REP_RE =
  /(\d+(?:\.\d+)?)\s*(kgs?|kilos?|kilograms?|lbs?|pounds?)\s*(?:x|×|for)\s*(\d+)\s*(?:reps?)?/gi

const LBS_TO_KG = 0.453592

function toKg(value, unit) {
  const isLbs = /lb|pound/i.test(unit)
  const kg = isLbs ? value * LBS_TO_KG : value
  return Math.round(kg * 100) / 100
}

function guessDifficulty(text) {
  const t = text.toLowerCase()
  if (/very heavy|failure|couldn.?t|needed support|too heavy/.test(t)) return 'failure'
  if (/heavy/.test(t)) return 'hard'
  if (/moderate|medium/.test(t)) return 'moderate'
  if (/easy/.test(t)) return 'easy'
  return 'moderate'
}

/**
 * @param {string} transcript
 * @returns {{ exerciseGuess: string, sets: Array<{set_number:number, weight_kg:number, reps:number, difficulty:string, notes:string|null}> }}
 */
export function parseVoiceTranscript(transcript) {
  const text = (transcript || '').trim()
  if (!text) return { exerciseGuess: '', sets: [] }

  const matches = [...text.matchAll(WEIGHT_REP_RE)]
  if (matches.length === 0) {
    // No weight/reps detected — treat the whole thing as an exercise name guess
    return { exerciseGuess: text, sets: [] }
  }

  const exerciseGuess = text
    .slice(0, matches[0].index)
    .replace(/[.,;:]+$/, '')
    .trim()

  const sets = matches.map((m, i) => {
    const [full, rawWeight, unit, rawReps] = m
    const start = m.index + full.length
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const trailing = text
      .slice(start, end)
      .replace(/^[.,;:\s]+/, '')
      .replace(/[.,;:\s]+$/, '')

    return {
      set_number: i + 1,
      weight_kg: toKg(parseFloat(rawWeight), unit),
      reps: parseInt(rawReps, 10),
      difficulty: guessDifficulty(trailing),
      notes: trailing || null,
    }
  })

  return { exerciseGuess, sets }
}

/** Fuzzy-matches a spoken exercise name guess against the known catalog. */
export function findClosestExercise(guess, exercises) {
  if (!guess || !exercises?.length) return null
  const g = guess.toLowerCase().trim()

  // Substring shortcut — only trust it when EXACTLY one exercise matches.
  // A generic word like "curl" matches Biceps Curl, Hammer Curl, Leg Curl, etc.
  // all at once — in that case fall through to token scoring below instead
  // of blindly picking whichever one happens to come first.
  const substringMatches = exercises.filter(
    (e) => g.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(g)
  )
  if (substringMatches.length === 1) return substringMatches[0]

  const gTokens = g.split(/\s+/).filter(Boolean)
  const pool = substringMatches.length > 1 ? substringMatches : exercises

  let best = null
  let bestScore = 0
  for (const e of pool) {
    const eTokens = e.name.toLowerCase().replace(/[()]/g, '').split(/\s+/).filter(Boolean)
    const score = eTokens.filter((t) => gTokens.includes(t)).length
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return bestScore > 0 ? best : null
}
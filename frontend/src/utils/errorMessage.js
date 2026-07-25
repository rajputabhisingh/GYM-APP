/** FastAPI/Pydantic sometimes returns `detail` as an array of validation-error
 * objects (e.g. when a query param violates a constraint) instead of a plain
 * string. Rendering that array directly as JSX crashes React ("object with
 * keys {type, loc, msg, input, ctx}"). This always returns a safe string. */
export function getErrorMessage(err, fallback = 'Something went wrong.') {
  const detail = err?.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const first = detail[0]
    if (first?.msg) return first.msg
    return fallback
  }

  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
    return detail.msg
  }

  if (typeof err?.message === 'string') return err.message

  return fallback
}
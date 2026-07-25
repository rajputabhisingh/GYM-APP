import axios from 'axios'

const STORAGE_KEY = 'gym_auth'

export function getStoredAuth() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setStoredAuth(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

client.interceptors.request.use((config) => {
  const auth = getStoredAuth()
  if (auth?.access_token) config.headers.Authorization = `Bearer ${auth.access_token}`
  return config
})

// Access tokens expire (Supabase default ~1hr). Previously there was no
// refresh handling at all, so any long session would start throwing
// "Invalid or expired token" on every call. This retries once with a
// refreshed token before giving up and sending the user back to /login.
let refreshPromise = null

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    if (status === 401 && original && !original._retried && !original.url?.includes('/auth/refresh')) {
      original._retried = true
      const auth = getStoredAuth()
      if (!auth?.refresh_token) {
        clearStoredAuth()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${client.defaults.baseURL}/auth/refresh`, { refresh_token: auth.refresh_token })
            .finally(() => {
              refreshPromise = null
            })
        }
        const refreshRes = await refreshPromise
        const updated = {
          access_token: refreshRes.data.access_token,
          refresh_token: refreshRes.data.refresh_token,
          profile: refreshRes.data.profile,
        }
        setStoredAuth(updated)
        original.headers.Authorization = `Bearer ${updated.access_token}`
        return client(original)
      } catch {
        clearStoredAuth()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default client
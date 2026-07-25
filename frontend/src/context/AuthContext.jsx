import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client, { getStoredAuth, setStoredAuth, clearStoredAuth } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getStoredAuth()
    if (auth) {
      setToken(auth.access_token)
      setProfile(auth.profile)
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await client.post('/auth/login', { email, password })
    const { access_token, refresh_token, profile } = res.data
    setStoredAuth({ access_token, refresh_token, profile })
    setToken(access_token)
    setProfile(profile)
    return profile
  }, [])

  const signup = useCallback(async ({ full_name, email, phone, password, role }) => {
    const res = await client.post('/auth/signup', { full_name, email, phone, password, role })
    return res.data
  }, [])

  const signupOwner = useCallback(async (payload) => {
    const res = await client.post('/auth/signup/owner', payload)
    return res.data
  }, [])

  const signupIndividual = useCallback(async (payload) => {
    const res = await client.post('/auth/signup/individual', payload)
    return res.data
  }, [])

  const signupTrainer = useCallback(async (payload) => {
    const res = await client.post('/auth/signup/trainer', payload)
    return res.data
  }, [])

  const resendVerification = useCallback(async (email) => {
    const res = await client.post('/auth/resend-verification', { email })
    return res.data
  }, [])

  const logout = useCallback(() => {
    clearStoredAuth()
    setToken(null)
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        profile,
        token,
        loading,
        login,
        signup,
        signupOwner,
        signupIndividual,
        signupTrainer,
        resendVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function dashboardPathForRole(role) {
  if (role === 'owner') return '/owner'
  if (role === 'trainer') return '/trainer'
  return '/individual'
}
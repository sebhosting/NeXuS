'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { authApi, User } from './auth'

interface AuthCtx {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)

  // On mount: try to refresh (restores session from httpOnly cookie)
  useEffect(() => {
    (async () => {
      const token = await authApi.refresh()
      if (token) {
        const me = await authApi.me(token)
        if (me) { setUser(me); setAccessToken(token) }
      }
      setLoading(false)
    })()
  }, [])

  // Auto-refresh access token every 13 minutes
  useEffect(() => {
    if (!accessToken) return
    const id = setInterval(async () => {
      const token = await authApi.refresh()
      if (token) setAccessToken(token)
      else { setUser(null); setAccessToken(null) }
    }, 13 * 60 * 1000)
    return () => clearInterval(id)
  }, [accessToken])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    setAccessToken(result.accessToken)
    setUser(result.user)
  }, [])

  const logout = useCallback(async () => {
    if (accessToken) await authApi.logout(accessToken)
    setUser(null)
    setAccessToken(null)
  }, [accessToken])

  const register = useCallback(async (username: string, email: string, password: string) => {
    await authApi.register(username, email, password)
  }, [])

  return (
    <Ctx.Provider value={{ user, accessToken, loading, login, logout, register }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

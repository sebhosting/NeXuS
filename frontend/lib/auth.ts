const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.sebhosting.com'

export interface User {
  id: string
  username: string
  email: string
  role: string
  lastLogin?: string
}

export interface AuthResult {
  accessToken: string
  user: User
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResult> {
    const res = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Login failed')
    }
    return res.json()
  },

  async register(username: string, email: string, password: string): Promise<void> {
    const res = await fetch(`${AUTH_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Registration failed')
    }
  },

  async refresh(): Promise<string | null> {
    try {
      const res = await fetch(`${AUTH_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.accessToken
    } catch { return null }
  },

  async me(accessToken: string): Promise<User | null> {
    try {
      const res = await fetch(`${AUTH_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      })
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  },

  async logout(accessToken: string): Promise<void> {
    await fetch(`${AUTH_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
  }
}

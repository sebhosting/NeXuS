import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { tokens } from '../jwt'
import { requireAuth } from '../middleware'

export const authRouter = Router()

function requireAdmin(req: Request, res: Response, next: Function) {
  if ((req as any).user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'strict' as const,
  path:     '/',
}

// ── REGISTER ──────────────────────────────────────────────────
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email and password required' })

    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' })

    // First user becomes admin, rest are viewers
    const userCount = await db.countUsers()
    const role = userCount === 0 ? 'admin' : 'viewer'

    const hash = await bcrypt.hash(password, 12)
    const user = await db.createUser(username, email, hash, role)

    res.status(201).json({
      message: 'Account created',
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    })
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already taken' })
    }
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── LOGIN ────────────────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' })

    const user = await db.findUserByEmail(email)
    if (!user)
      return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' })

    const payload = { userId: user.id, username: user.username, role: user.role }
    const accessToken  = tokens.signAccess(payload)
    const refreshToken = tokens.signRefresh(payload)

    // Store hashed refresh token in DB
    await db.saveRefreshToken(user.id, tokens.hashToken(refreshToken), tokens.refreshExpiry())
    await db.updateLastLogin(user.id)

    // Set refresh token as httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({
      accessToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── REFRESH ──────────────────────────────────────────────────
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token
    if (!refreshToken)
      return res.status(401).json({ error: 'No refresh token' })

    const payload = tokens.verifyRefresh(refreshToken)
    const tokenHash = tokens.hashToken(refreshToken)

    const stored = await db.findRefreshToken(payload.userId, tokenHash)
    if (!stored)
      return res.status(401).json({ error: 'Refresh token revoked' })

    // Rotate: delete old, issue new
    await db.deleteRefreshToken(payload.userId, tokenHash)

    const newPayload = { userId: payload.userId, username: payload.username, role: payload.role }
    const newAccess  = tokens.signAccess(newPayload)
    const newRefresh = tokens.signRefresh(newPayload)

    await db.saveRefreshToken(payload.userId, tokens.hashToken(newRefresh), tokens.refreshExpiry())

    res.cookie('refresh_token', newRefresh, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({ accessToken: newAccess })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// ── ME ───────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await db.findUserById((req as any).user.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role, lastLogin: user.last_login })
  } catch {
    res.status(500).json({ error: 'Failed to get user' })
  }
})

// ── LOGOUT ───────────────────────────────────────────────────
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token
  if (refreshToken) {
    try {
      const payload = tokens.verifyRefresh(refreshToken)
      await db.deleteAllRefreshTokens(payload.userId)
    } catch { /* expired token - still clear cookie */ }
  }
  res.clearCookie('refresh_token', COOKIE_OPTS)
  res.json({ message: 'Logged out' })
})

// ── USER MANAGEMENT (admin only) ───────────────────────────
authRouter.get('/users', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await db.listUsers()
    res.json(users)
  } catch {
    res.status(500).json({ error: 'Failed to list users' })
  }
})

authRouter.put('/users/:id/role', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { role } = req.body
    if (!role || !['admin', 'viewer'].includes(role))
      return res.status(400).json({ error: 'Role must be admin or viewer' })
    await db.updateUserRole(req.params.id as string, role)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to update role' })
  }
})

authRouter.put('/users/:id/active', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    if (typeof is_active !== 'boolean')
      return res.status(400).json({ error: 'is_active must be boolean' })
    await db.updateUserActive(req.params.id as string, is_active)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to update user status' })
  }
})

authRouter.delete('/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (req.params.id === (req as any).user.userId)
      return res.status(400).json({ error: 'Cannot delete your own account' })
    await db.deleteUser(req.params.id as string)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

authRouter.get('/sessions', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const sessions = await db.listActiveSessions()
    res.json(sessions)
  } catch {
    res.status(500).json({ error: 'Failed to list sessions' })
  }
})

// ── CHANGE PASSWORD ────────────────────────────────────────
authRouter.put('/me/password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current and new password required' })
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const user = await db.findUserById((req as any).user.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' })

    const hash = await bcrypt.hash(newPassword, 12)
    await db.updatePassword(user.id, hash)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to change password' })
  }
})

import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const ACCESS_SECRET  = process.env.JWT_SECRET        || 'change-me-access-secret'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret'

export interface TokenPayload {
  userId: string
  username: string
  role: string
}

export const tokens = {
  signAccess(payload: TokenPayload): string {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' })
  },

  signRefresh(payload: TokenPayload): string {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' })
  },

  verifyAccess(token: string): TokenPayload {
    return jwt.verify(token, ACCESS_SECRET) as TokenPayload
  },

  verifyRefresh(token: string): TokenPayload {
    return jwt.verify(token, REFRESH_SECRET) as TokenPayload
  },

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  },

  refreshExpiry(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
}

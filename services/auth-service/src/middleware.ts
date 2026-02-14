import { Request, Response, NextFunction } from 'express'
import { tokens } from './jwt'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.access_token

  if (!token) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  try {
    const payload = tokens.verifyAccess(token)
    ;(req as any).user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../utils/jwt.js'

export type AuthRequest = Request & {
  user?: { id: string }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.header('Authorization')
  // Media tags (<img>/<video>) cannot send Authorization headers, so GET requests
  // may carry the short-lived access token as a query param (pre-signed-URL pattern).
  const queryToken = req.method === 'GET' ? (req.query.access_token as string | undefined) : undefined
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken
  if (!token) {
    return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Bearer token required.' })
  }
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub }
    return next()
  } catch {
    return res.status(401).json({ code: 'AUTH_INVALID_TOKEN', message: 'Invalid or expired token.' })
  }
}

import type { NextFunction, Request, Response } from 'express'
import { User } from '../models/User.js'
import { verifyAccessToken } from '../utils/jwt.js'

export type AuthRequest = Request & {
  user?: { id: string }
}

// Short-lived cache so we don't hit Mongo for tokenVersion on every request.
// After a revoke, stale entries die within 10s (and we invalidate eagerly too).
const versionCache = new Map<string, { version: number; expiresAt: number }>()
const CACHE_TTL_MS = 10_000

export function invalidateTokenVersionCache(userId: string) {
  versionCache.delete(userId)
}

async function getTokenVersion(userId: string): Promise<number | null> {
  const cached = versionCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.version
  }
  const user = await User.findById(userId).select('tokenVersion')
  if (!user) {
    return null
  }
  versionCache.set(userId, { version: user.tokenVersion, expiresAt: Date.now() + CACHE_TTL_MS })
  return user.tokenVersion
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
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
    const currentVersion = await getTokenVersion(payload.sub)
    if (currentVersion === null || payload.tv !== currentVersion) {
      return res.status(401).json({ code: 'AUTH_SESSION_REVOKED', message: 'Session has been revoked.' })
    }
    req.user = { id: payload.sub }
    return next()
  } catch {
    return res.status(401).json({ code: 'AUTH_INVALID_TOKEN', message: 'Invalid or expired token.' })
  }
}

import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { User, type UserDocument } from '../models/User.js'
import { env } from '../config/env.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js'
import { hashToken, randomToken } from '../services/encryption.service.js'
import { sendPasswordResetEmail } from '../services/email.service.js'
import { ApiError } from '../utils/api-error.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'

export const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

const REFRESH_COOKIE = 'refreshToken'
const refreshTtlMs = () => env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth',
    maxAge: refreshTtlMs(),
  })
}

function publicUser(user: UserDocument) {
  return { id: user._id.toString(), name: user.name, email: user.email, createdAt: user.createdAt }
}

async function createSession(user: UserDocument, req: Request, res: Response) {
  const refreshToken = signRefreshToken({ sub: user._id.toString(), jti: randomToken(16) })
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    userAgent: req.header('User-Agent'),
    ipAddress: req.ip,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  })
  // Prune expired sessions while we're here.
  user.refreshTokens = user.refreshTokens.filter((entry) => entry.expiresAt > new Date())
  await user.save()

  setRefreshCookie(res, refreshToken)
  return { accessToken: signAccessToken({ sub: user._id.toString() }), refreshToken }
}

function readRefreshToken(req: Request) {
  return (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined)
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body)
    const existing = await User.findOne({ email: body.email })
    if (existing) throw ApiError.conflict('AUTH_EMAIL_TAKEN', 'Email already registered.')

    const user = await User.create({
      name: body.name,
      email: body.email,
      hashedPassword: await hashPassword(body.password),
    })
    const tokens = await createSession(user, req, res)
    return res.status(201).json({ ...tokens, user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body)
    const user = await User.findOne({ email: body.email }).select('+hashedPassword +refreshTokens')
    if (!user || !(await verifyPassword(user.hashedPassword, body.password))) {
      throw ApiError.unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.')
    }
    const tokens = await createSession(user, req, res)
    return res.json({ ...tokens, user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = readRefreshToken(req)
    if (!token) throw ApiError.unauthorized('AUTH_REFRESH_MISSING', 'Refresh token required.')

    let payload
    try {
      payload = verifyRefreshToken(token)
    } catch {
      throw ApiError.unauthorized('AUTH_SESSION_EXPIRED', 'Refresh token expired.')
    }

    const user = await User.findById(payload.sub).select('+refreshTokens')
    const tokenHash = hashToken(token)
    const session = user?.refreshTokens.find((entry) => entry.tokenHash === tokenHash && entry.expiresAt > new Date())
    if (!user || !session) throw ApiError.unauthorized('AUTH_SESSION_EXPIRED', 'Refresh token expired.')

    // Rotate: drop the old token, issue a fresh pair.
    user.refreshTokens = user.refreshTokens.filter((entry) => entry.tokenHash !== tokenHash)
    const tokens = await createSession(user, req, res)
    return res.json(tokens)
  } catch (error) {
    return next(error)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = readRefreshToken(req)
    if (token) {
      const tokenHash = hashToken(token)
      await User.updateOne(
        { 'refreshTokens.tokenHash': tokenHash },
        { $pull: { refreshTokens: { tokenHash } } },
      )
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const body = forgotPasswordSchema.parse(req.body)
    const user = await User.findOne({ email: body.email }).select('+passwordResetToken +passwordResetExpires')
    if (user) {
      const resetToken = randomToken()
      user.passwordResetToken = hashToken(resetToken)
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await user.save()
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`
      await sendPasswordResetEmail(user.email, resetUrl).catch((error) => {
        console.error('Failed to send password reset email:', error)
      })
    }
    // Always ok — never reveal whether the email exists.
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const body = resetPasswordSchema.parse(req.body)
    const user = await User.findOne({
      passwordResetToken: hashToken(body.token),
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +refreshTokens')
    if (!user) throw ApiError.badRequest('AUTH_RESET_TOKEN_INVALID', 'Reset token is invalid or expired.')

    user.hashedPassword = await hashPassword(body.password)
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    user.refreshTokens = [] // Invalidate all existing sessions.
    await user.save()

    res.clearCookie(REFRESH_COOKIE, { path: '/auth' })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await User.findById(req.user!.id).orFail()
    return res.json({ user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

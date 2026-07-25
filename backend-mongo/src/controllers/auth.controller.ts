import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { LoginOtp, type OtpPurpose } from '../models/LoginOtp.js'
import { User, type UserDocument } from '../models/User.js'
import { env } from '../config/env.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js'
import { hashToken, randomToken } from '../services/encryption.service.js'
import { sendLoginOtpEmail, sendNewLoginEmail, sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js'
import { ApiError } from '../utils/api-error.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'

const emailField = z.string().trim().toLowerCase().email()

export const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: emailField,
  password: z.string().min(8),
})

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export const otpRequestSchema = z.object({
  email: emailField,
})

export const otpVerifySchema = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
})

export const emailSchema = z.object({
  email: emailField,
})

export const resetPasswordWithCodeSchema = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  password: z.string().min(8),
})

const MAX_OTP_ATTEMPTS = 5

async function issueOtp(email: string, purpose: OtpPurpose) {
  const code = crypto.randomInt(100_000, 1_000_000).toString()
  await LoginOtp.findOneAndUpdate(
    { email, purpose },
    { codeHash: hashToken(code), attempts: 0, createdAt: new Date() },
    { upsert: true },
  )
  return code
}

async function verifyOtpCode(email: string, purpose: OtpPurpose, code: string) {
  const otp = await LoginOtp.findOne({ email, purpose })
  if (!otp || otp.attempts >= MAX_OTP_ATTEMPTS) {
    throw ApiError.unauthorized('OTP_INVALID', 'Code is invalid or expired.')
  }
  if (otp.codeHash !== hashToken(code)) {
    otp.attempts += 1
    await otp.save()
    throw ApiError.unauthorized('OTP_INVALID', 'Code is invalid or expired.')
  }
  await otp.deleteOne()
}

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

// Fire-and-forget: email the user about a new sign-in, with a one-click
// "sign out everywhere" link (single-use token, valid 24h).
function notifyNewLogin(user: UserDocument, req: Request) {
  void (async () => {
    try {
      const revokeToken = randomToken()
      user.passwordResetToken = hashToken(revokeToken)
      user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await user.save()

      const revokeUrl = `${req.protocol}://${req.get('host')}/auth/revoke-sessions?token=${revokeToken}`
      await sendNewLoginEmail(user.email, {
        device: (req.header('User-Agent') ?? 'Unknown device').slice(0, 140),
        ip: req.ip,
        time: new Date(),
        revokeUrl,
      })
    } catch (error) {
      console.error('Failed to send new-login notification:', error)
    }
  })()
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body)
    const existing = await User.findOne({ email: body.email })
    if (existing?.emailVerified) throw ApiError.conflict('AUTH_EMAIL_TAKEN', 'Email already registered.')

    // Unverified re-registration: replace the pending account and resend the code.
    if (existing) await existing.deleteOne()

    await User.create({
      name: body.name,
      email: body.email,
      hashedPassword: await hashPassword(body.password),
      emailVerified: false,
    })

    const code = await issueOtp(body.email, 'register')
    await sendVerificationEmail(body.email, code).catch((error) => {
      console.error('Failed to send verification email:', error)
    })

    return res.status(201).json({ status: 'ok', requiresVerification: true })
  } catch (error) {
    return next(error)
  }
}

// POST /auth/verify-email — confirm the registration code, then start the session.
export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const body = otpVerifySchema.parse(req.body)
    await verifyOtpCode(body.email, 'register', body.code)

    const user = await User.findOneAndUpdate(
      { email: body.email },
      { emailVerified: true },
      { new: true },
    ).select('+refreshTokens')
    if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'Account not found.')

    const tokens = await createSession(user, req, res)
    return res.json({ ...tokens, user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

// POST /auth/verify-email/resend
export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const body = emailSchema.parse(req.body)
    const user = await User.findOne({ email: body.email, emailVerified: false })
    if (user) {
      const code = await issueOtp(body.email, 'register')
      await sendVerificationEmail(body.email, code).catch((error) => {
        console.error('Failed to send verification email:', error)
      })
    }
    return res.json({ status: 'ok' })
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
    if (!user.emailVerified) {
      throw ApiError.forbidden('EMAIL_NOT_VERIFIED', 'Confirm your email first — we sent you a code at registration.')
    }
    const tokens = await createSession(user, req, res)
    notifyNewLogin(user, req)
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
    const user = await User.findOne({ email: body.email, emailVerified: true })
    if (user) {
      const code = await issueOtp(body.email, 'reset')
      await sendPasswordResetEmail(body.email, code).catch((error) => {
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
    const body = resetPasswordWithCodeSchema.parse(req.body)
    await verifyOtpCode(body.email, 'reset', body.code)

    const user = await User.findOne({ email: body.email }).select('+refreshTokens')
    if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'Account not found.')

    user.hashedPassword = await hashPassword(body.password)
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

// POST /auth/otp/request — email a 6-digit sign-in code (never reveals if the email exists).
export async function requestOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const body = otpRequestSchema.parse(req.body)
    const user = await User.findOne({ email: body.email, emailVerified: true })
    if (user) {
      const code = await issueOtp(body.email, 'login')
      await sendLoginOtpEmail(body.email, code).catch((error) => {
        console.error('Failed to send login OTP email:', error)
      })
    }
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

// POST /auth/otp/verify — exchange a valid code for a session.
export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const body = otpVerifySchema.parse(req.body)
    await verifyOtpCode(body.email, 'login', body.code)

    const user = await User.findOne({ email: body.email }).select('+refreshTokens').orFail()
    const tokens = await createSession(user, req, res)
    notifyNewLogin(user, req)
    return res.json({ ...tokens, user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

// GET /auth/revoke-sessions?token= — one-click "sign out everywhere" from the
// new-login alert email. Public (token-gated), works from any device.
export async function revokeSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const token = z.string().min(1).parse(req.query.token)
    const user = await User.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +refreshTokens')
    if (!user) {
      return res
        .status(400)
        .send('<h2 style="font-family:sans-serif">This sign-out link is invalid or expired.</h2>')
    }

    user.refreshTokens = []
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.clearCookie(REFRESH_COOKIE, { path: '/auth' })
    return res.send(
      '<h2 style="font-family:sans-serif">All sessions have been signed out. You can close this tab and sign in again.</h2>',
    )
  } catch (error) {
    return next(error)
  }
}

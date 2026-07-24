import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { authRateLimiter, emailRateLimiter } from '../middleware/rate-limit.middleware.js'
import * as authController from '../controllers/auth.controller.js'

export const authRouter = Router()

authRouter.use(authRateLimiter)

authRouter.post('/register', authController.register)
authRouter.post('/verify-email', authController.verifyEmail)
authRouter.post('/verify-email/resend', emailRateLimiter, authController.resendVerification)
authRouter.post('/login', authController.login)
authRouter.post('/refresh', authController.refresh)
authRouter.post('/logout', authController.logout)
authRouter.post('/forgot-password', emailRateLimiter, authController.forgotPassword)
authRouter.post('/reset-password', emailRateLimiter, authController.resetPassword)
authRouter.post('/otp/request', emailRateLimiter, authController.requestOtp)
authRouter.post('/otp/verify', authController.verifyOtp)
authRouter.get('/me', requireAuth, authController.me)

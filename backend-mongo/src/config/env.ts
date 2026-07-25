import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  APP_PORT: z.coerce.number().optional(),
  FRONTEND_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  ENCRYPTION_KEY: z.string().min(32),

  MAX_UPLOAD_BYTES: z.coerce.number().default(300 * 1024 * 1024),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GOOGLE_SCOPES: z
    .string()
    .default('https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile'),

  BREVO_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('PhotoDrive <no-reply@example.com>'),
})

const parsed = envSchema.parse(process.env)

export const env = {
  ...parsed,
  // Render (and most PaaS) injects PORT; APP_PORT stays as the local-dev override.
  APP_PORT: process.env.PORT ? Number(process.env.PORT) : (parsed.APP_PORT ?? 4000),
  GOOGLE_SCOPES: parsed.GOOGLE_SCOPES.split(',').map((scope) => scope.trim()).filter(Boolean),
}

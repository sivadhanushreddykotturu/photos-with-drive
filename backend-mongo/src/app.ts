import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js'
import { authRouter } from './routes/auth.routes.js'
import { connectedAccountRouter } from './routes/connected-account.routes.js'
import { fileRouter } from './routes/file.routes.js'

export const app = express()
app.set('trust proxy', true)

// Allow the web app origin plus the Capacitor WebView origins used by the Android app.
const allowedOrigins = [env.FRONTEND_URL, 'http://localhost', 'https://localhost', 'capacitor://localhost']
app.use(cors({
  origin: (origin, callback) => {
    // No Origin header (same-origin/native) or an allow-listed origin.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS origin rejected: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/auth', authRouter)
app.use('/connected-accounts', connectedAccountRouter)
app.use('/files', fileRouter)

app.use(notFoundMiddleware)
app.use(errorMiddleware)

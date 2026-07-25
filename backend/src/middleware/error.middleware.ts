import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { ZodError } from 'zod'
import { ApiError } from '../utils/api-error.js'

export function notFoundMiddleware(_req: Request, res: Response) {
  return res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found.' })
}

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ code: error.code, message: error.message })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data.',
      details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }

  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ code: 'INVALID_ID', message: 'Invalid identifier.' })
  }

  if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000) {
    return res.status(409).json({ code: 'DUPLICATE_KEY', message: 'Resource already exists.' })
  }

  console.error('Unhandled error:', error)
  const message = error instanceof Error ? error.message : 'Internal server error'
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message })
}

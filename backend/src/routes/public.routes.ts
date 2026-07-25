import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as shareController from '../controllers/share.controller.js'

export const publicRouter = Router()

// Token-gated but unauthenticated — keep abuse in check.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
})

publicRouter.use(publicLimiter)

publicRouter.get('/files/:token', shareController.getPublicSharedFile)
publicRouter.get('/files/:token/download', shareController.downloadPublicSharedFile)
publicRouter.get('/files/:token/thumbnail', shareController.getPublicSharedThumbnail)
publicRouter.get('/albums/:token', shareController.getPublicSharedAlbum)
publicRouter.get('/albums/:token/files/:fileId/download', shareController.downloadPublicAlbumFile)
publicRouter.get('/albums/:token/files/:fileId/thumbnail', shareController.getPublicAlbumFileThumbnail)

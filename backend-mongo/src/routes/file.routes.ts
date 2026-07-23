import { Router } from 'express'
import multer from 'multer'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import * as fileController from '../controllers/file.controller.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES },
})

export const fileRouter = Router()

fileRouter.use(requireAuth)

fileRouter.post('/upload', upload.single('file'), fileController.uploadFile)
fileRouter.post('/sync-google', fileController.syncGoogleFiles)
fileRouter.get('/', fileController.listFiles)
fileRouter.get('/:id', fileController.getFile)
fileRouter.get('/:id/view-url', fileController.getFileViewUrl)
fileRouter.get('/:id/download', fileController.downloadFile)
fileRouter.patch('/:id', fileController.patchFile)
fileRouter.delete('/:id', fileController.deleteFile)

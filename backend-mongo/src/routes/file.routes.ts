import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import * as fileController from '../controllers/file.controller.js'

export const fileRouter = Router()

fileRouter.use(requireAuth)

fileRouter.post('/upload', fileController.uploadFile)
fileRouter.post('/sync-google', fileController.syncGoogleFiles)
fileRouter.get('/', fileController.listFiles)
fileRouter.get('/:id', fileController.getFile)
fileRouter.get('/:id/view-url', fileController.getFileViewUrl)
fileRouter.get('/:id/thumbnail', fileController.getFileThumbnail)
fileRouter.get('/:id/download', fileController.downloadFile)
fileRouter.patch('/:id', fileController.patchFile)
fileRouter.delete('/:id', fileController.deleteFile)

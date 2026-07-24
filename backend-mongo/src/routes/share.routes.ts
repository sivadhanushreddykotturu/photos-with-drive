import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import * as shareController from '../controllers/share.controller.js'

export const shareRouter = Router()

shareRouter.use(requireAuth)

shareRouter.post('/', shareController.createShareLink)
shareRouter.get('/', shareController.listShareLinks)
shareRouter.delete('/:id', shareController.deleteShareLink)

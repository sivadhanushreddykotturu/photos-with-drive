import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import * as albumController from '../controllers/album.controller.js'

export const albumRouter = Router()

albumRouter.use(requireAuth)

albumRouter.get('/', albumController.listAlbums)
albumRouter.post('/', albumController.createAlbum)
albumRouter.get('/:id', albumController.getAlbum)
albumRouter.patch('/:id', albumController.patchAlbum)
albumRouter.delete('/:id', albumController.deleteAlbum)
albumRouter.put('/:id/assets', albumController.addAssetsToAlbum)
albumRouter.delete('/:id/assets', albumController.removeAssetsFromAlbum)

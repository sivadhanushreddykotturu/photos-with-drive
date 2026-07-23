import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import * as connectedAccountController from '../controllers/connected-account.controller.js'

export const connectedAccountRouter = Router()

// Public: Google redirects here after consent (authenticated via OauthState, not JWT).
connectedAccountRouter.get('/google/callback', connectedAccountController.googleCallback)

connectedAccountRouter.use(requireAuth)

connectedAccountRouter.get('/google/connect-url', connectedAccountController.googleConnectUrl)
connectedAccountRouter.get('/', connectedAccountController.listConnectedAccounts)
connectedAccountRouter.post('/:id/sync-quota', connectedAccountController.syncAccountQuota)
connectedAccountRouter.delete('/:id', connectedAccountController.deleteConnectedAccount)

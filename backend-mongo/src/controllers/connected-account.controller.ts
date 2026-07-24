import type { NextFunction, Response } from 'express'
import { z } from 'zod'
import { Album } from '../models/Album.js'
import { ConnectedAccount, type ConnectedAccountDocument } from '../models/ConnectedAccount.js'
import { FileRecord } from '../models/FileRecord.js'
import { OauthState } from '../models/OauthState.js'
import { env } from '../config/env.js'
import { encryptText, randomToken } from '../services/encryption.service.js'
import {
  exchangeCodeForTokens,
  generateConnectUrl,
  getGoogleAccountEmail,
  revokeGoogleAccount,
  syncGoogleQuota,
} from '../services/drive.service.js'
import { ApiError } from '../utils/api-error.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

function serializeAccount(account: ConnectedAccountDocument) {
  return {
    id: account._id.toString(),
    provider: account.provider,
    googleAccountEmail: account.googleAccountEmail,
    scope: account.scope,
    storageQuota: account.storageQuota,
    lastSyncedAt: account.lastSyncedAt ?? null,
    createdAt: account.createdAt,
  }
}

const errorRedirect = (res: Response) => res.redirect(`${env.FRONTEND_URL}/google-connected?status=error`)

export async function googleConnectUrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const state = await OauthState.create({ token: randomToken(), userId: req.user!.id })
    return res.json({ url: generateConnectUrl(state.token) })
  } catch (error) {
    return next(error)
  }
}

// Public route — the user arrives here via Google's redirect, so the OauthState
// doc (tied to the user at connect-url time) is what authenticates this flow.
export async function googleCallback(req: AuthRequest, res: Response) {
  try {
    const query = callbackQuerySchema.parse(req.query)
    // Single-use: consume the state doc before exchanging the code.
    const state = await OauthState.findOneAndDelete({ token: query.state })
    if (!state) return errorRedirect(res)

    const { client, tokens } = await exchangeCodeForTokens(query.code)
    client.setCredentials(tokens)
    const email = await getGoogleAccountEmail(client)

    const existing = await ConnectedAccount.findOne({
      userId: state.userId,
      provider: 'google',
      googleAccountEmail: email,
    }).select('+accessToken +refreshToken')

    // Google only returns a refresh token on first consent; keep the old one on re-connect.
    const refreshToken = tokens.refresh_token ? encryptText(tokens.refresh_token) : existing?.refreshToken
    if (!refreshToken) {
      console.error('Google connect failed: no refresh token returned and none stored.')
      return errorRedirect(res)
    }

    const account = existing ?? new ConnectedAccount({ userId: state.userId, provider: 'google', googleAccountEmail: email })
    account.accessToken = encryptText(tokens.access_token!)
    account.refreshToken = refreshToken
    account.tokenExpiresAt = new Date(tokens.expiry_date ?? Date.now() + 3600_000)
    account.scope = tokens.scope ? tokens.scope.split(' ') : env.GOOGLE_SCOPES
    await account.save()

    await syncGoogleQuota(account._id.toString()).catch(() => undefined)
    return res.redirect(`${env.FRONTEND_URL}/google-connected?status=success`)
  } catch (error) {
    console.error('Google OAuth callback failed:', error)
    return errorRedirect(res)
  }
}

export async function listConnectedAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accounts = await ConnectedAccount.find({ userId: req.user!.id }).sort({ createdAt: -1 })
    return res.json({ accounts: accounts.map(serializeAccount) })
  } catch (error) {
    return next(error)
  }
}

export async function syncAccountQuota(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const account = await ConnectedAccount.findOne({ _id: req.params.id, userId: req.user!.id })
    if (!account) throw ApiError.notFound('ACCOUNT_NOT_FOUND', 'Connected account not found.')
    const quota = await syncGoogleQuota(account._id.toString())
    return res.json({ quota })
  } catch (error) {
    return next(error)
  }
}

export async function deleteConnectedAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const account = await ConnectedAccount.findOne({ _id: req.params.id, userId: req.user!.id }).select('+refreshToken')
    if (!account) throw ApiError.notFound('ACCOUNT_NOT_FOUND', 'Connected account not found.')

    await revokeGoogleAccount(account)
    // Files in that Drive account are unreachable once disconnected — remove their records.
    const removedFiles = await FileRecord.find({ connectedAccountId: account._id, userId: req.user!.id }).select('_id')
    await FileRecord.deleteMany({ connectedAccountId: account._id, userId: req.user!.id })
    if (removedFiles.length > 0) {
      await Album.updateMany(
        { userId: req.user!.id, assetIds: { $in: removedFiles.map((file) => file._id) } },
        { $pull: { assetIds: { $in: removedFiles.map((file) => file._id) } } },
      )
    }
    await account.deleteOne()
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

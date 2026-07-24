import busboy from 'busboy'
import type { NextFunction, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { env } from '../config/env.js'
import { Album } from '../models/Album.js'
import { ConnectedAccount } from '../models/ConnectedAccount.js'
import { FileRecord, type FileRecordDocument } from '../models/FileRecord.js'
import { VirtualFolder } from '../models/VirtualFolder.js'
import {
  deleteDriveFile,
  ensureAppFolder,
  getAuthedGoogleClient,
  getDriveFileStream,
  listAppFolderFiles,
  renameDriveFile,
  syncGoogleQuota,
  uploadFileToDrive,
  type DriveFileEntry,
} from '../services/drive.service.js'
import { ApiError } from '../utils/api-error.js'
import { pickUploadAccount } from '../utils/account-selector.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'

const listQuerySchema = z.object({
  folderId: z.string().optional(),
  type: z.enum(['media', 'all']).default('all'),
  groupBy: z.enum(['date']).optional(),
})

const patchFileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    folderId: z.string().nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.folderId !== undefined, {
    message: 'At least one of name or folderId is required.',
  })

function serializeFile(file: FileRecordDocument) {
  return {
    id: file._id.toString(),
    connectedAccountId: file.connectedAccountId.toString(),
    driveFileId: file.driveFileId,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    thumbnailLink: file.thumbnailLink ?? null,
    imageMediaMetadata: file.imageMediaMetadata ?? null,
    videoMediaMetadata: file.videoMediaMetadata ?? null,
    createdTime: file.createdTime,
    folderId: file.folderId?.toString() ?? null,
    isDeleted: file.isDeleted,
  }
}

function parseFolderId(raw: string | null | undefined) {
  if (raw === undefined || raw === null || raw === '' || raw === 'root') return null
  if (!mongoose.isValidObjectId(raw)) throw ApiError.badRequest('INVALID_FOLDER_ID', 'Invalid folderId.')
  return new mongoose.Types.ObjectId(raw)
}

async function assertFolderOwnership(userId: string, folderId: mongoose.Types.ObjectId | null) {
  if (!folderId) return
  const folder = await VirtualFolder.findOne({ _id: folderId, userId })
  if (!folder) throw ApiError.notFound('FOLDER_NOT_FOUND', 'Folder not found.')
}

async function findOwnedFile(req: AuthRequest) {
  const file = await FileRecord.findOne({ _id: req.params.id, userId: req.user!.id, isDeleted: false })
  if (!file) throw ApiError.notFound('FILE_NOT_FOUND', 'File not found.')
  return file
}

async function findOwnedAccount(userId: string, accountId: mongoose.Types.ObjectId) {
  const account = await ConnectedAccount.findOne({ _id: accountId, userId }).select('+accessToken +refreshToken')
  if (!account) throw ApiError.notFound('ACCOUNT_NOT_FOUND', 'Connected account not found for this file.')
  return account
}

// POST /files/upload (multipart, field "file", optional "folderId")
// Streams the request body straight into Drive (busboy) — the file is never
// buffered in server memory, so large uploads can't OOM the instance.
export function uploadFile(req: AuthRequest, res: Response, next: NextFunction) {
  const contentLength = Number(req.headers['content-length'] ?? 0)
  if (!contentLength) {
    return next(ApiError.badRequest('FILE_REQUIRED', 'No file uploaded. Send multipart field "file".'))
  }

  let folderIdRaw: string | undefined
  let responded = false
  const fail = (error: unknown) => {
    if (!responded) {
      responded = true
      req.unpipe(bb)
      next(error)
    }
  }

  const bb = busboy({ headers: req.headers, limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 } })

  bb.on('field', (name, value) => {
    if (name === 'folderId') folderIdRaw = value
  })

  bb.on('file', (fieldName, stream, info) => {
    if (fieldName !== 'file') {
      stream.resume()
      return
    }

    stream.on('limit', () => {
      stream.resume()
      fail(new ApiError(413, 'UPLOAD_TOO_LARGE', 'Uploaded file exceeds the size limit.'))
    })

    void (async () => {
      try {
        // content-length includes multipart overhead; close enough for account picking.
        const approxSize = contentLength
        const folderId = parseFolderId(folderIdRaw)
        await assertFolderOwnership(req.user!.id, folderId)

        const accounts = await ConnectedAccount.find({ userId: req.user!.id }).select('+accessToken +refreshToken')
        if (accounts.length === 0) throw ApiError.badRequest('NO_CONNECTED_ACCOUNT', 'Connect a Google Drive account first.')

        const account = pickUploadAccount(accounts, approxSize)
        if (!account) throw new ApiError(413, 'INSUFFICIENT_STORAGE', 'No connected account has enough free space.')

        // busboy decodes filenames as latin1; recover UTF-8 names.
        const fileName = Buffer.from(info.filename, 'latin1').toString('utf8')

        const auth = await getAuthedGoogleClient(account)
        const appFolderId = await ensureAppFolder(auth)

        const driveFile = await uploadFileToDrive(auth, appFolderId, {
          name: fileName,
          mimeType: info.mimeType || 'application/octet-stream',
          body: stream,
        })

        const record = await FileRecord.create({
          userId: req.user!.id,
          connectedAccountId: account._id,
          driveFileId: driveFile.id,
          name: driveFile.name ?? fileName,
          mimeType: driveFile.mimeType ?? info.mimeType,
          size: driveFile.size ? Number(driveFile.size) : approxSize,
          thumbnailLink: driveFile.thumbnailLink ?? undefined,
          imageMediaMetadata: driveFile.imageMediaMetadata
            ? { width: driveFile.imageMediaMetadata.width ?? undefined, height: driveFile.imageMediaMetadata.height ?? undefined }
            : undefined,
          videoMediaMetadata: driveFile.videoMediaMetadata?.durationMillis
            ? { duration: Number(driveFile.videoMediaMetadata.durationMillis) }
            : undefined,
          createdTime: driveFile.createdTime ? new Date(driveFile.createdTime) : new Date(),
          folderId,
        })

        account.storageQuota.used += record.size
        await account.save()

        if (!responded) {
          responded = true
          res.status(201).json({ file: serializeFile(record) })
        }
      } catch (error) {
        stream.resume() // drain so the connection can settle
        fail(error)
      }
    })()
  })

  bb.on('filesLimit', () => fail(ApiError.badRequest('TOO_MANY_FILES', 'Upload one file per request.')))
  bb.on('error', (error) => fail(error))
  req.on('error', (error) => fail(error))

  req.pipe(bb)
}

// GET /files?folderId=&type=media|all&groupBy=date
export async function listFiles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query)
    const filter: {
      userId: string
      isDeleted: boolean
      folderId?: mongoose.Types.ObjectId | null
      mimeType?: RegExp
    } = { userId: req.user!.id, isDeleted: false }

    if (query.folderId !== undefined) filter.folderId = parseFolderId(query.folderId)
    if (query.type === 'media') filter.mimeType = /^(image|video)\//

    const files = await FileRecord.find(filter).sort({ createdTime: -1 })

    if (query.groupBy === 'date') {
      const buckets = new Map<string, ReturnType<typeof serializeFile>[]>()
      for (const file of files) {
        const date = file.createdTime.toISOString().slice(0, 10)
        const bucket = buckets.get(date)
        if (bucket) bucket.push(serializeFile(file))
        else buckets.set(date, [serializeFile(file)])
      }
      const groups = [...buckets.entries()].map(([date, bucketFiles]) => ({ date, files: bucketFiles }))
      return res.json({ groups })
    }

    return res.json({ files: files.map(serializeFile) })
  } catch (error) {
    return next(error)
  }
}

// GET /files/:id
export async function getFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    return res.json({ file: serializeFile(await findOwnedFile(req)) })
  } catch (error) {
    return next(error)
  }
}

// GET /files/:id/view-url
export async function getFileViewUrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await findOwnedFile(req)
    return res.json({
      url: file.thumbnailLink ?? null,
      downloadUrl: `/files/${file._id.toString()}/download?disposition=inline`,
    })
  } catch (error) {
    return next(error)
  }
}

// GET /files/:id/download?disposition=inline|attachment
export async function downloadFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await findOwnedFile(req)
    const account = await findOwnedAccount(req.user!.id, file.connectedAccountId)
    const auth = await getAuthedGoogleClient(account)

    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment'
    const stream = await getDriveFileStream(auth, file.driveFileId).catch((error: unknown) => {
      if ((error as { code?: number })?.code === 404) {
        throw ApiError.notFound('FILE_NOT_FOUND_ON_DRIVE', 'File no longer exists on Google Drive.')
      }
      throw error
    })

    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    if (file.size > 0) res.setHeader('Content-Length', file.size)
    stream.on('error', (error: unknown) => res.destroy(error as Error))
    stream.pipe(res)
  } catch (error) {
    return next(error)
  }
}

// PATCH /files/:id  { name?, folderId? }
export async function patchFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = patchFileSchema.parse(req.body)
    const file = await findOwnedFile(req)

    if (body.name !== undefined && body.name !== file.name) {
      const account = await findOwnedAccount(req.user!.id, file.connectedAccountId)
      const auth = await getAuthedGoogleClient(account)
      await renameDriveFile(auth, file.driveFileId, body.name)
      file.name = body.name
    }

    if (body.folderId !== undefined) {
      const folderId = parseFolderId(body.folderId)
      await assertFolderOwnership(req.user!.id, folderId)
      file.folderId = folderId
    }

    await file.save()
    return res.json({ file: serializeFile(file) })
  } catch (error) {
    return next(error)
  }
}

// DELETE /files/:id
export async function deleteFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await findOwnedFile(req)
    const account = await ConnectedAccount.findOne({ _id: file.connectedAccountId, userId: req.user!.id }).select(
      '+accessToken +refreshToken',
    )
    if (account) {
      const auth = await getAuthedGoogleClient(account)
      await deleteDriveFile(auth, file.driveFileId).catch((error: unknown) => {
        if ((error as { code?: number })?.code !== 404) console.error('Drive delete failed:', error)
      })
      account.storageQuota.used = Math.max(0, account.storageQuota.used - file.size)
      await account.save()
    }
    file.isDeleted = true
    await file.save()
    // Remove the deleted file from every album it belonged to.
    await Album.updateMany({ userId: req.user!.id, assetIds: file._id }, { $pull: { assetIds: file._id } })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

// POST /files/sync-google — reconcile Mongo records with the Drive app folder, per account.
export async function syncGoogleFiles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accounts = await ConnectedAccount.find({ userId: req.user!.id }).select('+accessToken +refreshToken')
    const results = []

    for (const account of accounts) {
      try {
        const auth = await getAuthedGoogleClient(account)
        const appFolderId = await ensureAppFolder(auth)
        const driveFiles = await listAppFolderFiles(auth, appFolderId)
        const existing = await FileRecord.find({ userId: req.user!.id, connectedAccountId: account._id })

        const existingByDriveId = new Map(existing.map((file) => [file.driveFileId, file]))
        const driveIds = new Set(driveFiles.map((file) => file.id))
        let created = 0
        let updated = 0
        let deleted = 0

        for (const driveFile of driveFiles) {
          if (!driveFile.id || !driveFile.name || !driveFile.mimeType) continue
          const record = existingByDriveId.get(driveFile.id)
          if (!record) {
            await FileRecord.create(driveFileToRecord(driveFile, req.user!.id, account._id))
            created += 1
            continue
          }

          const size = driveFile.size ? Number(driveFile.size) : 0
          if (record.name !== driveFile.name || record.mimeType !== driveFile.mimeType || record.size !== size || record.isDeleted) {
            record.name = driveFile.name
            record.mimeType = driveFile.mimeType
            record.size = size
            record.thumbnailLink = driveFile.thumbnailLink ?? undefined
            record.isDeleted = false
            await record.save()
            updated += 1
          }
        }

        for (const record of existing) {
          if (!record.isDeleted && !driveIds.has(record.driveFileId)) {
            record.isDeleted = true
            await record.save()
            deleted += 1
          }
        }
        if (deleted > 0) {
          const removedIds = existing.filter((record) => record.isDeleted).map((record) => record._id)
          await Album.updateMany(
            { userId: req.user!.id, assetIds: { $in: removedIds } },
            { $pull: { assetIds: { $in: removedIds } } },
          )
        }

        await syncGoogleQuota(account._id.toString()).catch(() => undefined)
        results.push({ accountId: account._id.toString(), googleAccountEmail: account.googleAccountEmail, created, updated, deleted })
      } catch (error) {
        console.error(`Sync failed for account ${account._id.toString()}:`, error)
        results.push({ accountId: account._id.toString(), googleAccountEmail: account.googleAccountEmail, error: 'SYNC_FAILED' })
      }
    }

    return res.json({ results })
  } catch (error) {
    return next(error)
  }
}

function driveFileToRecord(
  driveFile: DriveFileEntry,
  userId: string,
  connectedAccountId: mongoose.Types.ObjectId,
) {
  return {
    userId,
    connectedAccountId,
    driveFileId: driveFile.id!,
    name: driveFile.name!,
    mimeType: driveFile.mimeType!,
    size: driveFile.size ? Number(driveFile.size) : 0,
    thumbnailLink: driveFile.thumbnailLink ?? undefined,
    imageMediaMetadata: driveFile.imageMediaMetadata
      ? { width: driveFile.imageMediaMetadata.width ?? undefined, height: driveFile.imageMediaMetadata.height ?? undefined }
      : undefined,
    videoMediaMetadata: driveFile.videoMediaMetadata?.durationMillis
      ? { duration: Number(driveFile.videoMediaMetadata.durationMillis) }
      : undefined,
    createdTime: driveFile.createdTime ? new Date(driveFile.createdTime) : new Date(),
    folderId: null,
    isDeleted: false,
  }
}

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
  getDriveMediaMetadata,
  getDriveThumbnailLink,
  getDriveThumbnailStream,
  listAppFolderFiles,
  renameDriveFile,
  syncGoogleQuota,
  uploadFileToDrive,
  type DriveFileEntry,
} from '../services/drive.service.js'
import { ApiError } from '../utils/api-error.js'
import { pickUploadAccount } from '../utils/account-selector.js'
import { streamZipOfFiles } from '../services/zip.service.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'

const listQuerySchema = z.object({
  folderId: z.string().optional(),
  type: z.enum(['media', 'all']).default('all'),
  groupBy: z.enum(['date']).optional(),
  favorite: z.coerce.boolean().optional(),
})

const patchFileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    folderId: z.string().nullable().optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.folderId !== undefined || data.isFavorite !== undefined, {
    message: 'At least one of name, folderId or isFavorite is required.',
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
    deletedAt: file.deletedAt ?? null,
    isFavorite: file.isFavorite,
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

  // Pre-flight reject: fail oversize uploads before consuming any body, so the
  // client aborts in the first KBs instead of stalling at the limit mid-stream.
  if (contentLength > env.MAX_UPLOAD_BYTES) {
    res.setHeader('Connection', 'close')
    return next(new ApiError(413, 'UPLOAD_TOO_LARGE', 'Uploaded file exceeds the size limit.'))
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

    // Backstop for chunked uploads without a Content-Length header.
    stream.on('limit', () => {
      stream.destroy()
      res.setHeader('Connection', 'close')
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
      isFavorite?: boolean
    } = { userId: req.user!.id, isDeleted: false }

    if (query.folderId !== undefined) filter.folderId = parseFolderId(query.folderId)
    if (query.type === 'media') filter.mimeType = /^(image|video)\//
    if (query.favorite === true) filter.isFavorite = true

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

// GET /files/download-zip?ids=id1,id2,... — stream a ZIP of the given files (max 50).
const ZIP_MAX_FILES = 50

export async function downloadFilesZip(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const raw = String(req.query.ids ?? '')
    const ids = raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    if (ids.length === 0) throw ApiError.badRequest('IDS_REQUIRED', 'Provide at least one file id.')
    if (ids.length > ZIP_MAX_FILES) throw ApiError.badRequest('TOO_MANY_FILES', `ZIP downloads are limited to ${ZIP_MAX_FILES} files.`)

    const files = await FileRecord.find({ _id: { $in: ids }, userId: req.user!.id, isDeleted: false }).sort({
      createdTime: -1,
    })
    if (files.length === 0) throw ApiError.notFound('FILES_NOT_FOUND', 'No files found for the given ids.')

    const zipName = ids.length === 1 ? `${files[0].name}.zip` : `photos-${new Date().toISOString().slice(0, 10)}.zip`
    await streamZipOfFiles(files, zipName, res)
  } catch (error) {
    return next(error)
  }
}

// GET /files/:id — lazily backfills Drive media metadata (dimensions, video
// duration), which Drive populates asynchronously after upload.
export async function getFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await findOwnedFile(req)
    const isVideo = file.mimeType.startsWith('video/')
    const missingVideoDuration = isVideo && !file.videoMediaMetadata?.duration
    const missingImageSize = !isVideo && !file.imageMediaMetadata?.width

    if (missingVideoDuration || missingImageSize) {
      const account = await findOwnedAccount(req.user!.id, file.connectedAccountId)
      const auth = await getAuthedGoogleClient(account)
      const metadata = await getDriveMediaMetadata(auth, file.driveFileId).catch(() => null)
      if (metadata) {
        if (metadata.imageMediaMetadata && (metadata.imageMediaMetadata.width || metadata.imageMediaMetadata.height)) {
          file.imageMediaMetadata = {
            width: metadata.imageMediaMetadata.width ?? undefined,
            height: metadata.imageMediaMetadata.height ?? undefined,
          }
        }
        if (metadata.videoMediaMetadata?.durationMillis) {
          file.videoMediaMetadata = { duration: Number(metadata.videoMediaMetadata.durationMillis) }
        }
        await file.save()
      }
    }

    return res.json({ file: serializeFile(file) })
  } catch (error) {
    return next(error)
  }
}

// GET /files/:id/view-url
export async function getFileViewUrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await findOwnedFile(req)
    return res.json({
      url: `/files/${file._id.toString()}/thumbnail`,
      downloadUrl: `/files/${file._id.toString()}/download?disposition=inline`,
    })
  } catch (error) {
    return next(error)
  }
}

// GET /files/:id/thumbnail — proxy Drive's auto-generated thumbnail (images and
// video poster frames). Drive generates them asynchronously, so we lazily
// refresh the stored thumbnailLink when it's missing or stale.
export async function getFileThumbnail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await findOwnedFile(req)
    const account = await findOwnedAccount(req.user!.id, file.connectedAccountId)
    const auth = await getAuthedGoogleClient(account)

    let thumbnailLink: string | undefined = file.thumbnailLink
    if (!thumbnailLink) {
      thumbnailLink = (await getDriveThumbnailLink(auth, file.driveFileId)) ?? undefined
      if (thumbnailLink) {
        file.thumbnailLink = thumbnailLink
        await file.save()
      }
    }

    // Drive processes thumbs async — until then, fall back to the original for
    // images so tiles always render (videos still need the poster frame).
    if (!thumbnailLink) {
      if (!file.mimeType.startsWith('image/')) {
        throw ApiError.notFound('THUMBNAIL_NOT_READY', 'Thumbnail is not available yet.')
      }
      const stream = await getDriveFileStream(auth, file.driveFileId)
      res.setHeader('Content-Type', file.mimeType)
      if (file.size > 0) res.setHeader('Content-Length', file.size)
      stream.on('error', (error: unknown) => res.destroy(error as Error))
      stream.pipe(res)
      return
    }

    let thumbResponse
    try {
      thumbResponse = await getDriveThumbnailStream(auth, thumbnailLink)
    } catch {
      // Stored link went stale (they expire) — refresh once and retry.
      thumbnailLink = (await getDriveThumbnailLink(auth, file.driveFileId)) ?? undefined
      if (!thumbnailLink) throw ApiError.notFound('THUMBNAIL_NOT_READY', 'Thumbnail is not available yet.')
      file.thumbnailLink = thumbnailLink
      await file.save()
      thumbResponse = await getDriveThumbnailStream(auth, thumbnailLink)
    }

    res.setHeader('Content-Type', thumbResponse.headers.get('content-type') ?? 'image/jpeg')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    ;(thumbResponse.data as NodeJS.ReadableStream).on('error', (error) => res.destroy(error))
    ;(thumbResponse.data as NodeJS.ReadableStream).pipe(res)
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

    if (body.isFavorite !== undefined) {
      file.isFavorite = body.isFavorite
    }

    await file.save()
    return res.json({ file: serializeFile(file) })
  } catch (error) {
    return next(error)
  }
}

// DELETE /files/:id — TRASH only: marks the record deleted but keeps the Drive
// file, so it can be restored. Permanent removal happens via DELETE /files/:id/permanent.
export async function deleteFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await findOwnedFile(req)
    file.isDeleted = true
    file.deletedAt = new Date()
    await file.save()
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

// GET /files/trash
export async function listTrashedFiles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const files = await FileRecord.find({ userId: req.user!.id, isDeleted: true }).sort({ deletedAt: -1 })
    return res.json({ files: files.map(serializeFile) })
  } catch (error) {
    return next(error)
  }
}

// POST /files/:id/restore
export async function restoreFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await FileRecord.findOne({ _id: req.params.id, userId: req.user!.id, isDeleted: true })
    if (!file) throw ApiError.notFound('FILE_NOT_FOUND', 'File not found in trash.')
    file.isDeleted = false
    file.deletedAt = undefined
    await file.save()
    return res.json({ file: serializeFile(file) })
  } catch (error) {
    return next(error)
  }
}

// DELETE /files/:id/permanent — delete from Drive + remove the record for good.
export async function permanentlyDeleteFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const file = await FileRecord.findOne({ _id: req.params.id, userId: req.user!.id })
    if (!file) throw ApiError.notFound('FILE_NOT_FOUND', 'File not found.')

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

    await file.deleteOne()
    await Album.updateMany({ userId: req.user!.id, assetIds: file._id }, { $pull: { assetIds: file._id } })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

// POST /files/trash/empty — permanently delete everything in trash.
export async function emptyTrash(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const trashed = await FileRecord.find({ userId: req.user!.id, isDeleted: true })
    let deleted = 0
    const failed: string[] = []

    for (const file of trashed) {
      try {
        const account = await ConnectedAccount.findOne({ _id: file.connectedAccountId, userId: req.user!.id }).select(
          '+accessToken +refreshToken',
        )
        if (account) {
          const auth = await getAuthedGoogleClient(account)
          await deleteDriveFile(auth, file.driveFileId).catch(() => undefined)
          account.storageQuota.used = Math.max(0, account.storageQuota.used - file.size)
          await account.save()
        }
        await file.deleteOne()
        deleted += 1
      } catch (error) {
        console.error(`Failed to permanently delete ${file._id.toString()}:`, error)
        failed.push(file._id.toString())
      }
    }

    const removedIds = trashed.map((file) => file._id)
    await Album.updateMany({ userId: req.user!.id, assetIds: { $in: removedIds } }, { $pull: { assetIds: { $in: removedIds } } })
    return res.json({ deleted, failed: failed.length })
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
          const thumbChanged = (driveFile.thumbnailLink ?? null) !== (record.thumbnailLink ?? null)
          const duration = driveFile.videoMediaMetadata?.durationMillis ? Number(driveFile.videoMediaMetadata.durationMillis) : undefined
          const metadataChanged =
            duration !== undefined && duration !== record.videoMediaMetadata?.duration
          if (
            record.name !== driveFile.name ||
            record.mimeType !== driveFile.mimeType ||
            record.size !== size ||
            record.isDeleted ||
            thumbChanged ||
            metadataChanged
          ) {
            record.name = driveFile.name
            record.mimeType = driveFile.mimeType
            record.size = size
            record.thumbnailLink = driveFile.thumbnailLink ?? undefined
            if (duration !== undefined) record.videoMediaMetadata = { duration }
            if (driveFile.imageMediaMetadata) {
              record.imageMediaMetadata = {
                width: driveFile.imageMediaMetadata.width ?? undefined,
                height: driveFile.imageMediaMetadata.height ?? undefined,
              }
            }
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

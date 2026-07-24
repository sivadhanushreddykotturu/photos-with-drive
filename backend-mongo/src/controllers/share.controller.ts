import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Album } from '../models/Album.js'
import { ConnectedAccount } from '../models/ConnectedAccount.js'
import { FileRecord, type FileRecordDocument } from '../models/FileRecord.js'
import { SharedLink, type SharedLinkDocument } from '../models/SharedLink.js'
import { env } from '../config/env.js'
import { hashToken, randomToken } from '../services/encryption.service.js'
import {
  getAuthedGoogleClient,
  getDriveFileStream,
  getDriveThumbnailLink,
  getDriveThumbnailStream,
} from '../services/drive.service.js'
import { ApiError } from '../utils/api-error.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'

const createShareSchema = z
  .object({
    fileId: z.string().optional(),
    albumId: z.string().optional(),
    expiresInHours: z.number().positive().max(24 * 365).nullable().optional(),
  })
  .refine((data) => (data.fileId ? !data.albumId : !!data.albumId), {
    message: 'Exactly one of fileId or albumId is required.',
  })

function serializeLink(link: SharedLinkDocument & { fileId?: unknown; albumId?: unknown }) {
  return {
    id: link._id.toString(),
    file: link.fileId ?? null,
    album: link.albumId ?? null,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
  }
}

// POST /share { fileId? | albumId?, expiresInHours? }
export async function createShareLink(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = createShareSchema.parse(req.body)

    if (body.fileId) {
      if (!mongoose.isValidObjectId(body.fileId)) throw ApiError.badRequest('INVALID_ID', 'Invalid file id.')
      const file = await FileRecord.findOne({ _id: body.fileId, userId: req.user!.id, isDeleted: false })
      if (!file) throw ApiError.notFound('FILE_NOT_FOUND', 'File not found.')
    }
    if (body.albumId) {
      if (!mongoose.isValidObjectId(body.albumId)) throw ApiError.badRequest('INVALID_ID', 'Invalid album id.')
      const album = await Album.findOne({ _id: body.albumId, userId: req.user!.id })
      if (!album) throw ApiError.notFound('ALBUM_NOT_FOUND', 'Album not found.')
    }

    const token = randomToken()
    const expiresAt = body.expiresInHours ? new Date(Date.now() + body.expiresInHours * 3600_000) : null
    await SharedLink.create({
      tokenHash: hashToken(token),
      userId: req.user!.id,
      fileId: body.fileId ?? null,
      albumId: body.albumId ?? null,
      expiresAt,
    })

    return res.status(201).json({ token, url: `${env.FRONTEND_URL}/share/${token}`, expiresAt })
  } catch (error) {
    return next(error)
  }
}

// GET /share — list my links (with file/album names)
export async function listShareLinks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const links = await SharedLink.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .populate('fileId', 'name mimeType')
      .populate('albumId', 'name')
    return res.json({ links: links.map(serializeLink) })
  } catch (error) {
    return next(error)
  }
}

// DELETE /share/:id
export async function deleteShareLink(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const link = await SharedLink.findOne({ _id: req.params.id, userId: req.user!.id })
    if (!link) throw ApiError.notFound('LINK_NOT_FOUND', 'Share link not found.')
    await link.deleteOne()
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

// ---------------------------------------------------------------------------
// Public (token-gated, unauthenticated) handlers
// ---------------------------------------------------------------------------

async function findValidLink(token: string, kind: 'file' | 'album') {
  const link = await SharedLink.findOne({ tokenHash: hashToken(token) })
  if (!link) throw ApiError.notFound('LINK_INVALID', 'This share link is invalid.')
  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new ApiError(410, 'LINK_EXPIRED', 'This share link has expired.')
  }
  if (kind === 'file' && !link.fileId) throw ApiError.notFound('LINK_INVALID', 'This share link is invalid.')
  if (kind === 'album' && !link.albumId) throw ApiError.notFound('LINK_INVALID', 'This share link is invalid.')
  return link
}

async function getPublicFile(fileId: mongoose.Types.ObjectId) {
  const file = await FileRecord.findOne({ _id: fileId, isDeleted: false })
  if (!file) throw ApiError.notFound('FILE_NOT_FOUND', 'This file is no longer available.')
  return file
}

function publicFile(file: FileRecordDocument) {
  return {
    id: file._id.toString(),
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    isVideo: file.mimeType.startsWith('video/'),
    createdTime: file.createdTime,
  }
}

async function streamPublicDownload(link: SharedLinkDocument, file: FileRecordDocument, res: Response, disposition: string) {
  const account = await ConnectedAccount.findById(file.connectedAccountId).select('+accessToken +refreshToken')
  if (!account) throw ApiError.notFound('FILE_NOT_FOUND', 'This file is no longer available.')
  const auth = await getAuthedGoogleClient(account)
  const stream = await getDriveFileStream(auth, file.driveFileId).catch((error: unknown) => {
    if ((error as { code?: number })?.code === 404) throw ApiError.notFound('FILE_NOT_FOUND', 'This file is no longer available.')
    throw error
  })
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`)
  if (file.size > 0) res.setHeader('Content-Length', file.size)
  stream.on('error', (error: unknown) => res.destroy(error as Error))
  stream.pipe(res)
}

// GET /public/files/:token
export async function getPublicSharedFile(req: Request, res: Response, next: NextFunction) {
  try {
    const link = await findValidLink(String(req.params.token), 'file')
    const file = await getPublicFile(link.fileId!)
    return res.json({ file: publicFile(file), expiresAt: link.expiresAt })
  } catch (error) {
    return next(error)
  }
}

// GET /public/files/:token/download
export async function downloadPublicSharedFile(req: Request, res: Response, next: NextFunction) {
  try {
    const link = await findValidLink(String(req.params.token), 'file')
    const file = await getPublicFile(link.fileId!)
    const disposition = req.query.disposition === 'attachment' ? 'attachment' : 'inline'
    await streamPublicDownload(link, file, res, disposition)
  } catch (error) {
    return next(error)
  }
}

// GET /public/files/:token/thumbnail
export async function getPublicSharedThumbnail(req: Request, res: Response, next: NextFunction) {
  try {
    const link = await findValidLink(String(req.params.token), 'file')
    const file = await getPublicFile(link.fileId!)
    const account = await ConnectedAccount.findById(file.connectedAccountId).select('+accessToken +refreshToken')
    if (!account) throw ApiError.notFound('FILE_NOT_FOUND', 'This file is no longer available.')
    const auth = await getAuthedGoogleClient(account)

    const thumbnailLink = file.thumbnailLink ?? (await getDriveThumbnailLink(auth, file.driveFileId))
    if (!thumbnailLink) throw ApiError.notFound('THUMBNAIL_NOT_READY', 'Thumbnail is not available yet.')
    if (!file.thumbnailLink) {
      file.thumbnailLink = thumbnailLink
      await file.save()
    }

    const thumbResponse = await getDriveThumbnailStream(auth, thumbnailLink)
    res.setHeader('Content-Type', thumbResponse.headers.get('content-type') ?? 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    ;(thumbResponse.data as NodeJS.ReadableStream).on('error', (error) => res.destroy(error))
    ;(thumbResponse.data as NodeJS.ReadableStream).pipe(res)
  } catch (error) {
    return next(error)
  }
}

// GET /public/albums/:token
export async function getPublicSharedAlbum(req: Request, res: Response, next: NextFunction) {
  try {
    const link = await findValidLink(String(req.params.token), 'album')
    const album = await Album.findById(link.albumId)
    if (!album) throw ApiError.notFound('ALBUM_NOT_FOUND', 'This album is no longer available.')
    const files = await FileRecord.find({ _id: { $in: album.assetIds }, isDeleted: false }).sort({ createdTime: -1 })
    return res.json({
      album: { name: album.name, assetCount: files.length },
      files: files.map(publicFile),
      expiresAt: link.expiresAt,
    })
  } catch (error) {
    return next(error)
  }
}

async function findAlbumFile(token: string, rawFileId: string) {
  const link = await findValidLink(token, 'album')
  if (!mongoose.isValidObjectId(rawFileId)) throw ApiError.badRequest('INVALID_ID', 'Invalid file id.')
  const fileId = new mongoose.Types.ObjectId(rawFileId)
  const album = await Album.findById(link.albumId)
  if (!album || !album.assetIds.some((id) => id.equals(fileId))) {
    throw ApiError.notFound('FILE_NOT_FOUND', 'This file is no longer available.')
  }
  const file = await getPublicFile(fileId)
  return { link, file }
}

// GET /public/albums/:token/files/:fileId/download
export async function downloadPublicAlbumFile(req: Request, res: Response, next: NextFunction) {
  try {
    const { link, file } = await findAlbumFile(String(req.params.token), String(req.params.fileId))
    const disposition = req.query.disposition === 'attachment' ? 'attachment' : 'inline'
    await streamPublicDownload(link, file, res, disposition)
  } catch (error) {
    return next(error)
  }
}

// GET /public/albums/:token/files/:fileId/thumbnail
export async function getPublicAlbumFileThumbnail(req: Request, res: Response, next: NextFunction) {
  try {
    const { file } = await findAlbumFile(String(req.params.token), String(req.params.fileId))
    const account = await ConnectedAccount.findById(file.connectedAccountId).select('+accessToken +refreshToken')
    if (!account) throw ApiError.notFound('FILE_NOT_FOUND', 'This file is no longer available.')
    const auth = await getAuthedGoogleClient(account)

    const thumbnailLink = file.thumbnailLink ?? (await getDriveThumbnailLink(auth, file.driveFileId))
    if (!thumbnailLink) throw ApiError.notFound('THUMBNAIL_NOT_READY', 'Thumbnail is not available yet.')
    if (!file.thumbnailLink) {
      file.thumbnailLink = thumbnailLink
      await file.save()
    }

    const thumbResponse = await getDriveThumbnailStream(auth, thumbnailLink)
    res.setHeader('Content-Type', thumbResponse.headers.get('content-type') ?? 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    ;(thumbResponse.data as NodeJS.ReadableStream).on('error', (error) => res.destroy(error))
    ;(thumbResponse.data as NodeJS.ReadableStream).pipe(res)
  } catch (error) {
    return next(error)
  }
}

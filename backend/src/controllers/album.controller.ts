import type { NextFunction, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Album, type AlbumDocument } from '../models/Album.js'
import { FileRecord, type FileRecordDocument } from '../models/FileRecord.js'
import { ApiError } from '../utils/api-error.js'
import { streamZipOfFiles } from '../services/zip.service.js'
import type { AuthRequest } from '../middleware/auth.middleware.js'

const createAlbumSchema = z.object({ name: z.string().trim().min(1).max(200) })
const patchAlbumSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    coverAssetId: z.string().nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.coverAssetId !== undefined, {
    message: 'At least one of name or coverAssetId is required.',
  })
const assetIdsSchema = z.object({ assetIds: z.array(z.string().min(1)).min(1).max(1000) })

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

function serializeAlbum(album: AlbumDocument) {
  return {
    id: album._id.toString(),
    name: album.name,
    assetCount: album.assetIds.length,
    coverAssetId: album.coverAssetId?.toString() ?? album.assetIds[0]?.toString() ?? null,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  }
}

async function findOwnedAlbum(req: AuthRequest) {
  const album = await Album.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!album) throw ApiError.notFound('ALBUM_NOT_FOUND', 'Album not found.')
  return album
}

function validAssetIds(raw: string[]) {
  const ids = raw.filter((id) => mongoose.isValidObjectId(id))
  if (ids.length !== raw.length) throw ApiError.badRequest('INVALID_ASSET_ID', 'Invalid asset id in list.')
  return ids.map((id) => new mongoose.Types.ObjectId(id))
}

// GET /albums
export async function listAlbums(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const albums = await Album.find({ userId: req.user!.id }).sort({ updatedAt: -1 })
    return res.json({ albums: albums.map(serializeAlbum) })
  } catch (error) {
    return next(error)
  }
}

// POST /albums { name }
export async function createAlbum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = createAlbumSchema.parse(req.body)
    const album = await Album.create({ userId: req.user!.id, name: body.name })
    return res.status(201).json({ album: serializeAlbum(album) })
  } catch (error) {
    return next(error)
  }
}

// GET /albums/:id
export async function getAlbum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const album = await findOwnedAlbum(req)
    const files = await FileRecord.find({ _id: { $in: album.assetIds }, userId: req.user!.id, isDeleted: false }).sort({
      createdTime: -1,
    })
    return res.json({ album: serializeAlbum(album), files: files.map(serializeFile) })
  } catch (error) {
    return next(error)
  }
}

// PATCH /albums/:id { name?, coverAssetId? }
export async function patchAlbum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = patchAlbumSchema.parse(req.body)
    const album = await findOwnedAlbum(req)

    if (body.name !== undefined) album.name = body.name
    if (body.coverAssetId !== undefined) {
      if (body.coverAssetId === null) {
        album.coverAssetId = null
      } else {
        const [coverId] = validAssetIds([body.coverAssetId])
        if (!album.assetIds.some((id) => id.equals(coverId))) {
          throw ApiError.badRequest('COVER_NOT_IN_ALBUM', 'Cover asset must be a member of the album.')
        }
        album.coverAssetId = coverId
      }
    }

    await album.save()
    return res.json({ album: serializeAlbum(album) })
  } catch (error) {
    return next(error)
  }
}

// GET /albums/:id/download-zip — stream a ZIP of the whole album.
export async function downloadAlbumZip(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const album = await findOwnedAlbum(req)
    const files = await FileRecord.find({ _id: { $in: album.assetIds }, userId: req.user!.id, isDeleted: false }).sort({
      createdTime: -1,
    })
    if (files.length === 0) throw ApiError.badRequest('ALBUM_EMPTY', 'This album has no files to download.')

    const safeName = album.name.replaceAll(/[^\w\d]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'album'
    await streamZipOfFiles(files, `${safeName}.zip`, res)
  } catch (error) {
    return next(error)
  }
}

// DELETE /albums/:id — deletes the album only, never the files.
export async function deleteAlbum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const album = await findOwnedAlbum(req)
    await album.deleteOne()
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
}

// PUT /albums/:id/assets { assetIds } — add members ($addToSet = idempotent, no dupes)
export async function addAssetsToAlbum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = assetIdsSchema.parse(req.body)
    const album = await findOwnedAlbum(req)
    const ids = validAssetIds(body.assetIds)

    // Only allow adding files the user actually owns.
    const ownedCount = await FileRecord.countDocuments({ _id: { $in: ids }, userId: req.user!.id, isDeleted: false })
    if (ownedCount !== ids.length) {
      throw ApiError.badRequest('ASSET_NOT_FOUND', 'One or more assets were not found.')
    }

    await Album.updateOne({ _id: album._id }, { $addToSet: { assetIds: { $each: ids } } })
    const updated = await Album.findById(album._id).orFail()
    return res.json({ album: serializeAlbum(updated) })
  } catch (error) {
    return next(error)
  }
}

// DELETE /albums/:id/assets { assetIds } — remove members ($pull)
export async function removeAssetsFromAlbum(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = assetIdsSchema.parse(req.body)
    const album = await findOwnedAlbum(req)
    const ids = validAssetIds(body.assetIds)

    await Album.updateOne({ _id: album._id }, { $pull: { assetIds: { $in: ids } } })
    // Clear the cover if it just left the album.
    await Album.updateOne({ _id: album._id, coverAssetId: { $in: ids } }, { $set: { coverAssetId: null } })
    const updated = await Album.findById(album._id).orFail()
    return res.json({ album: serializeAlbum(updated) })
  } catch (error) {
    return next(error)
  }
}

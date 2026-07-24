import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface IImageMediaMetadata {
  width?: number
  height?: number
}

export interface IVideoMediaMetadata {
  duration?: number
}

export interface IFileRecord {
  userId: Types.ObjectId
  connectedAccountId: Types.ObjectId
  driveFileId: string
  name: string
  mimeType: string
  size: number
  thumbnailLink?: string
  imageMediaMetadata?: IImageMediaMetadata
  videoMediaMetadata?: IVideoMediaMetadata
  createdTime: Date
  folderId: Types.ObjectId | null
  isDeleted: boolean
  deletedAt?: Date
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
}

export type FileRecordDocument = HydratedDocument<IFileRecord>

const imageMediaMetadataSchema = new Schema<IImageMediaMetadata>(
  {
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
)

const videoMediaMetadataSchema = new Schema<IVideoMediaMetadata>(
  {
    duration: { type: Number },
  },
  { _id: false },
)

const fileRecordSchema = new Schema<IFileRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    connectedAccountId: { type: Schema.Types.ObjectId, ref: 'ConnectedAccount', required: true },
    driveFileId: { type: String, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, default: 0 },
    thumbnailLink: { type: String },
    imageMediaMetadata: { type: imageMediaMetadataSchema },
    videoMediaMetadata: { type: videoMediaMetadataSchema },
    createdTime: { type: Date, required: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'VirtualFolder', default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true },
)

fileRecordSchema.index({ connectedAccountId: 1, driveFileId: 1 }, { unique: true })
fileRecordSchema.index({ userId: 1, folderId: 1, isDeleted: 1 })
fileRecordSchema.index({ userId: 1, createdTime: -1 })
fileRecordSchema.index({ userId: 1, isFavorite: 1, isDeleted: 1 })

export const FileRecord: Model<IFileRecord> = mongoose.model<IFileRecord>('FileRecord', fileRecordSchema)

import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface ISharedLink {
  tokenHash: string
  userId: Types.ObjectId
  fileId: Types.ObjectId | null
  albumId: Types.ObjectId | null
  expiresAt: Date | null // null = never expires
  createdAt: Date
}

export type SharedLinkDocument = HydratedDocument<ISharedLink>

const sharedLinkSchema = new Schema<ISharedLink>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileId: { type: Schema.Types.ObjectId, ref: 'FileRecord', default: null },
    albumId: { type: Schema.Types.ObjectId, ref: 'Album', default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

export const SharedLink: Model<ISharedLink> = mongoose.model<ISharedLink>('SharedLink', sharedLinkSchema)

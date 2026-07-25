import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface IAlbum {
  userId: Types.ObjectId
  name: string
  // Albums are pure references — membership costs 12 bytes per photo, never a copy.
  assetIds: Types.ObjectId[]
  coverAssetId: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

export type AlbumDocument = HydratedDocument<IAlbum>

const albumSchema = new Schema<IAlbum>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    assetIds: { type: [Schema.Types.ObjectId], ref: 'FileRecord', default: [] },
    coverAssetId: { type: Schema.Types.ObjectId, ref: 'FileRecord', default: null },
  },
  { timestamps: true },
)

albumSchema.index({ userId: 1, name: 1 })

export const Album: Model<IAlbum> = mongoose.model<IAlbum>('Album', albumSchema)

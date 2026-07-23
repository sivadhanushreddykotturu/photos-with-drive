import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface IVirtualFolder {
  userId: Types.ObjectId
  name: string
  parentFolderId: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

export type VirtualFolderDocument = HydratedDocument<IVirtualFolder>

const virtualFolderSchema = new Schema<IVirtualFolder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: 'VirtualFolder', default: null },
  },
  { timestamps: true },
)

virtualFolderSchema.index({ userId: 1, parentFolderId: 1 })

export const VirtualFolder: Model<IVirtualFolder> = mongoose.model<IVirtualFolder>(
  'VirtualFolder',
  virtualFolderSchema,
)

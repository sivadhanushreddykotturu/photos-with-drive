import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface IStorageQuota {
  total: number | null
  used: number
}

export interface IConnectedAccount {
  userId: Types.ObjectId
  provider: 'google'
  googleAccountEmail: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date
  scope: string[]
  storageQuota: IStorageQuota
  lastSyncedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type ConnectedAccountDocument = HydratedDocument<IConnectedAccount>

const storageQuotaSchema = new Schema<IStorageQuota>(
  {
    total: { type: Number, default: null },
    used: { type: Number, default: 0 },
  },
  { _id: false },
)

const connectedAccountSchema = new Schema<IConnectedAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['google'], default: 'google' },
    googleAccountEmail: { type: String, required: true, lowercase: true, trim: true },
    accessToken: { type: String, required: true, select: false },
    refreshToken: { type: String, required: true, select: false },
    tokenExpiresAt: { type: Date, required: true },
    scope: { type: [String], default: [] },
    storageQuota: { type: storageQuotaSchema, default: () => ({ total: null, used: 0 }) },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true },
)

connectedAccountSchema.index({ userId: 1, provider: 1, googleAccountEmail: 1 }, { unique: true })

export const ConnectedAccount: Model<IConnectedAccount> = mongoose.model<IConnectedAccount>(
  'ConnectedAccount',
  connectedAccountSchema,
)

import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface IOauthState {
  token: string
  userId: Types.ObjectId
  createdAt: Date
}

export type OauthStateDocument = HydratedDocument<IOauthState>

const oauthStateSchema = new Schema<IOauthState>({
  token: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
})

// TTL: MongoDB deletes state docs 10 minutes after creation (CSRF window for OAuth redirect).
oauthStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 })

export const OauthState: Model<IOauthState> = mongoose.model<IOauthState>('OauthState', oauthStateSchema)

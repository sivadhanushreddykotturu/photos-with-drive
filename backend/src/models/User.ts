import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose'

export interface IRefreshToken {
  tokenHash: string
  userAgent?: string
  ipAddress?: string
  createdAt: Date
  expiresAt: Date
}

export interface IUser {
  email: string
  name: string
  hashedPassword: string
  emailVerified: boolean
  tokenVersion: number
  refreshTokens: IRefreshToken[]
  passwordResetToken?: string
  passwordResetExpires?: Date
  createdAt: Date
  updatedAt: Date
}

export type UserDocument = HydratedDocument<IUser>

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
)

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    hashedPassword: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
)

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema)

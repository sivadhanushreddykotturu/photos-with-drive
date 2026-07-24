import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export type OtpPurpose = 'login' | 'register' | 'reset'

export interface ILoginOtp {
  email: string
  purpose: OtpPurpose
  codeHash: string
  attempts: number
  createdAt: Date
}

export type LoginOtpDocument = HydratedDocument<ILoginOtp>

const loginOtpSchema = new Schema<ILoginOtp>({
  email: { type: String, required: true, lowercase: true, trim: true },
  purpose: { type: String, enum: ['login', 'register', 'reset'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

loginOtpSchema.index({ email: 1, purpose: 1 }, { unique: true })

// TTL: codes self-destruct 10 minutes after creation.
loginOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 })

export const LoginOtp: Model<ILoginOtp> = mongoose.model<ILoginOtp>('LoginOtp', loginOtpSchema)

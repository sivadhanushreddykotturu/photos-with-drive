import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface ILoginOtp {
  email: string
  codeHash: string
  attempts: number
  createdAt: Date
}

export type LoginOtpDocument = HydratedDocument<ILoginOtp>

const loginOtpSchema = new Schema<ILoginOtp>({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

// TTL: codes self-destruct 10 minutes after creation.
loginOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 })

export const LoginOtp: Model<ILoginOtp> = mongoose.model<ILoginOtp>('LoginOtp', loginOtpSchema)

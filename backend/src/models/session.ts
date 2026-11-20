import { Schema, model, type Types } from 'mongoose'

/** A server-side login session. The cookie holds the token; only its SHA-256 is stored. */
export interface Session {
  _id: Types.ObjectId
  tokenHash: string
  userId: Types.ObjectId
  expiresAt: Date
  createdAt: Date
}

const sessionSchema = new Schema<Session>(
  {
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
)

sessionSchema.index({ tokenHash: 1 }, { unique: true })
sessionSchema.index({ userId: 1 })
// MongoDB deletes expired sessions (the TTL monitor runs about once a minute;
// lookups also check expiresAt, so a session never outlives it).
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const SessionModel = model<Session>('Session', sessionSchema)

import { Schema, model, type HydratedDocument, type Types } from 'mongoose'
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from '../auth/validation.js'

export interface User {
  _id: Types.ObjectId
  /** Normalised (trimmed, lower-case). Unique. */
  email: string
  /** Argon2id encoded hash. Excluded from queries unless explicitly selected. */
  passwordHash: string
  name: string
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: EMAIL_MAX_LENGTH },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX_LENGTH },
  },
  { timestamps: true, strict: 'throw' },
)

// The unique index (not an application check) is what prevents duplicate accounts,
// including two registrations racing each other.
userSchema.index({ email: 1 }, { unique: true })

export const UserModel = model<User>('User', userSchema)
export type UserDocument = HydratedDocument<User>

/** The only shape of a user that leaves the API. */
export interface PublicUser {
  id: string
  email: string
  name: string
  createdAt: string
}

export function toPublicUser(user: Pick<User, '_id' | 'email' | 'name' | 'createdAt'>): PublicUser {
  return { id: user._id.toString(), email: user.email, name: user.name, createdAt: user.createdAt.toISOString() }
}

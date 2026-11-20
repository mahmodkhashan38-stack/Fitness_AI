import { MongoMemoryServer } from 'mongodb-memory-server-core'
import mongoose from 'mongoose'
import { SessionModel } from '../../src/models/session.js'
import { UserModel } from '../../src/models/user.js'

/**
 * Starts a throwaway MongoDB server for one test file (a real mongod, never Atlas).
 * On a normal machine the binary is downloaded on first use and cached; set
 * MONGOMS_SYSTEM_BINARY to use an installed mongod instead.
 */
export async function startTestDatabase() {
  const server = await MongoMemoryServer.create()
  await mongoose.connect(server.getUri('fitness_ai_test'))
  // Same as production start-up (autoIndex is off there): unique email/token and TTL indexes.
  await Promise.all([UserModel.createIndexes(), SessionModel.createIndexes()])

  return {
    clear: async () => {
      await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})])
    },
    stop: async () => {
      await mongoose.disconnect()
      await server.stop()
    },
  }
}

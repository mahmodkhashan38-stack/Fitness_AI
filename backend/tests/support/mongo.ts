import { MongoMemoryReplSet } from 'mongodb-memory-server-core'
import mongoose from 'mongoose'
import { FitnessProfileModel } from '../../src/models/fitness-profile.js'
import { SessionModel } from '../../src/models/session.js'
import { UserModel } from '../../src/models/user.js'

/**
 * Starts a throwaway single-node MongoDB replica set for one test file (a real mongod, never Atlas).
 * A replica set, like every Atlas cluster, so registration's multi-document transaction runs for real.
 * On a normal machine the binary is downloaded on first use and cached; set
 * MONGOMS_SYSTEM_BINARY to use an installed mongod instead.
 */
export async function startTestDatabase() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(replSet.getUri('fitness_ai_test'))
  // Same as production start-up (autoIndex is off there): unique email/token/profile owner and TTL indexes.
  await Promise.all([UserModel.createIndexes(), SessionModel.createIndexes(), FitnessProfileModel.createIndexes()])

  return {
    uri: replSet.getUri('fitness_ai_test'),
    clear: async () => {
      await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({}), FitnessProfileModel.deleteMany({})])
    },
    stop: async () => {
      await mongoose.disconnect()
      await replSet.stop()
    },
  }
}

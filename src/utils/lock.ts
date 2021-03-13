import { locks } from './db'

export async function lock(name: string): Promise<boolean> {
  try {
    await locks
      .put({ id: name, ttl: Math.floor((Date.now() + 60 ** 2 * 1000) / 1000) })
      .ifNotExists()
  } catch (e) {
    if (e.code === 'ConditionalCheckFailedException') return false
    throw e
  }
  return true
}

export async function unlock(name: string) {
  await locks.delete(name)
}

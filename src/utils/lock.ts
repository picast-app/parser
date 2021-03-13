import { locks } from './db'

export async function lock(name: string): Promise<boolean> {
  try {
    await locks
      .put({ id: name, ttl: Math.floor(Date.now() / 1000) + 60 })
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

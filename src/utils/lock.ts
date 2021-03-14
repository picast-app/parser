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

export async function createCountdown(name: string, countdown: number) {
  const id = `${name}#count`
  await locks.put({
    id,
    countdown,
    ttl: Math.floor(Date.now() / 1000) + 600,
  })
}

export async function countdown(name: string) {
  const id = `${name}#count`
  try {
    await locks.client
      .update({
        TableName: locks.table,
        Key: { id },
        UpdateExpression: 'SET countdown = countdown + :incr',
        ConditionExpression: 'countdown > :min',
        ExpressionAttributeValues: { ':incr': -1, ':min': 1 },
      })
      .promise()
  } catch (e) {
    if (e.code !== 'ConditionalCheckFailedException') throw e
    await locks.delete(id)
    return false
  }
  return true
}

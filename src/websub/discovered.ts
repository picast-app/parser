import * as db from '~/utils/db'

export default async function (podcast: string, hub: string, topic: string) {
  if (process.env.IS_OFFLINE) return
  logger.info('store discovered hub', { podcast, hub, topic })
  try {
    await db.websub
      .put({ podcast, hub, topic, status: 'pending' })
      .ifNotExists()
  } catch (error) {
    logger.warn('failed to store discovered hub', { error })
  }
}

import fetchFeed from '~/utils/fetchFeed'
import * as gql from './gql'
import * as db from '~/utils/db'
import * as format from './format'
import * as art from './image'

export async function parse({ id, feed }: { id: string; feed?: string }) {
  if (!id || !feed) throw Error('must provide podcast id & feed')
  logger.info('parse', { id, feed })

  const [{ crc }, existing] = await Promise.all([
    fetchFeed(feed, false),
    db.podcasts.get(id),
  ])

  if (existing?.crc === crc && !process.env.IS_OFFLINE) return

  const data = await gql.parse(feed)
  data.id = id
  data.feed = feed
  data.crc = crc

  const episodes = format.episodes(data, !existing)
  await storeMeta(data, !existing && episodes)

  await storeParserMeta(data, episodes)
}

async function storeMeta(data: any, episodes?: any[]) {
  logger.info(`store meta ${data.id} (${data.title})`)
  const meta = format.meta(data, episodes)
  if (process.env.IS_OFFLINE) meta.covers = await art.fetch(data.id)
  const old = await db.podcasts.update(data.id, meta).returning('OLD')
  if (old?.artwork !== meta.artwork) await art.resize(data.id, meta.artwork)
}

async function storeParserMeta(data: any, episodes: any[]) {
  const episodeIds = episodes.map(({ eId }) => eId)
  const old = await db.parser
    .put({
      id: `${data.id}#parser`,
      feed: data.feed,
      crc: data.crc,
      lastParsed: Date.now(),
      episodes: episodeIds,
    })
    .returning('OLD')

  if (!old) return
  const removed = old.episodes?.filter(id => !episodeIds.includes(id))
  if (removed?.length) await removeEpisodes(data.id, removed)
}

async function removeEpisodes(podcast: string, ids: string[]) {
  logger.info(`remove ${ids.length} episodes from ${podcast}:`, ...ids)
  await Promise.all([
    db.episodes.batchDelete(
      ...ids.map(id => [podcast, id] as [string, string])
    ),
    db.podcasts.update(podcast).add({ episodeCount: -ids.length }),
  ])
}

import fetchFeed from '~/utils/fetchFeed'
import * as gql from './gql'
import * as db from '~/utils/db'
import * as format from './format'
import * as art from './image'
import * as page from './pagination'
import * as mutex from '~/utils/lock'
import websub from '~/websub/discovered'

export async function parse({ id, feed }: { id: string; feed?: string }) {
  if (!id || !feed) throw Error('must provide podcast id & feed')
  if (!(await mutex.lock(id))) {
    logger.info(`skip parse ${id} (locked)`)
    return
  }

  logger.info('parse', { id, feed })
  const [{ crc }, existing] = await Promise.all([
    fetchFeed(feed, false),
    db.parser.get(`${id}#parser`),
  ])

  if (existing?.crc === crc && !process.env.IS_OFFLINE) {
    await mutex.unlock(id)
    logger.info('skip parse (crc matches)')
    return
  }

  const data = await gql.parse(feed)
  data.id = id
  data.feed = feed
  data.crc = crc

  if (
    data.hub &&
    data.self &&
    (existing?.websub?.hub !== data.hub || existing?.websub?.self !== data.self)
  )
    await websub(id, data.hub, data.self)

  const episodes = format.episodes(data, !existing)
  const pagination = page.opts(data)
  const hasKnown = existing?.episodes?.some(id =>
    episodes.find(({ eId }) => eId === id)
  )

  const added = episodes.filter(({ eId }) => !existing?.episodes?.includes(eId))
  const removed =
    pagination.type !== 'none'
      ? []
      : existing?.episodes?.filter(
          id => !episodes.find(({ eId }) => eId === id)
        ) ?? []
  await deleteEpisodes(id, removed)

  data.episodeCheck = format.episodeCheck(
    await storeParserMeta(
      data,
      added.map(({ eId }) => eId),
      { remove: removed }
    )
  )

  await storeMeta(
    data,
    pagination.type === 'none' || hasKnown
      ? { deltaEps: added.length - removed.length }
      : undefined
  )
  await storeEpisodes(added)

  if (pagination.type === 'none' || hasKnown) return await mutex.unlock(id)
  await page.schedule(
    id,
    ...(pagination.type === 'incr' ? [pagination.next] : pagination.pages)
  )
}

export async function parsePage(id: string, pageUrl: string, incr: boolean) {
  if (!id || !pageUrl) throw Error('must provide podcast id & feed')
  logger.info(`parse ${id} ${incr ? 'incremental' : 'batch'} page ${pageUrl}`)

  try {
    const [data, existing] = await Promise.all([
      gql.parse(pageUrl),
      db.parser.get(`${id}#parser`),
    ])

    const episodes = format.episodes(data, true, id)
    const added = episodes.filter(
      ({ eId }) => !existing?.episodes?.includes(eId)
    )
    logger.info(`${episodes.length} episodes, ${added.length} new`)

    if (incr && !added.length) return await finalize(id)

    await Promise.all([
      storeParserMeta(
        { id },
        added.map(({ eId }) => eId),
        { firstPage: false }
      ),
      storeEpisodes(added),
    ])

    if (incr) await page.schedule(id, page.guessNextPage(pageUrl))
    else if (!(await mutex.countdown(id))) await finalize(id)
  } catch (error) {
    logger.warn(`failed to parse ${id} ${page}`, { error })
    if (incr || !(await mutex.countdown(id))) await finalize(id)
  }
}

async function finalize(id: string) {
  logger.info(`finalize ${id}`)

  const { episodes } = await db.parser.get(`${id}#parser`).strong()
  const episodeCheck = format.episodeCheck(episodes)

  logger.info(`${episodes.length} episodes (${episodeCheck})`)
  await db.podcasts.update(id, { episodeCheck, episodeCount: episodes.length })

  await mutex.unlock(id)
}

async function storeMeta(data: any, eps?: { deltaEps: number }) {
  logger.info(`store meta ${data.id} (${data.title})`)
  const meta = format.meta(data)
  logger.info(meta)
  if (process.env.IS_OFFLINE) meta.covers = await art.fetch(data.id)
  let query = db.podcasts.update(data.id, meta).returning('OLD')
  if (eps) query = query.add({ episodeCount: eps.deltaEps })
  const old = await query
  if (old?.artwork !== meta.artwork) await art.resize(data.id, meta.artwork)
}

async function storeEpisodes(episodes: any[]) {
  if (!episodes?.length) return
  logger.info(`store ${episodes.length} episodes`)
  try {
    await db.episodes.batchPut(...episodes)
  } catch (error) {
    logger.error(`failed to store episodes`, { error, sample: episodes[0] })
    throw error
  }
}

async function storeParserMeta(
  data: any,
  episodes: string[],
  {
    record = `${data.id}#parser`,
    firstPage = true,
    ...opts
  }: { record?: string; remove?: string[]; firstPage?: boolean } = {}
) {
  logger.info(`store parser meta`, { record, firstPage })
  try {
    let query = db.parser
      .update(
        record,
        firstPage
          ? {
              feed: data.feed,
              crc: data.crc,
              lastParsed: Date.now(),
              ...(data.hub && { websub: { hub: data.hub, self: data.self } }),
            }
          : undefined
      )
      .returning('NEW')
    if (!data.hub) query = query.remove('websub')

    if (episodes?.length) query = query.add({ episodes })
    if (opts.remove?.length)
      await db.parser.update(record).delete({ episodes: opts.remove })

    const { episodes: epIds } = await query
    return epIds
  } catch (error) {
    logger.error('failed to store parser meta', { error })
    throw error
  }
}

async function deleteEpisodes(podcast: string, episodes: string[]) {
  if (!episodes?.length) return
  logger.info(`remove ${episodes.length} episodes from ${podcast}`)
  await db.episodes.batchDelete(
    ...episodes.map(id => [podcast, id] as [string, string])
  )
}

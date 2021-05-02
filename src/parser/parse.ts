import fetchFeed from '~/utils/fetchFeed'
import * as core from './core'
import * as db from '~/utils/db'
import * as format from './format'
import * as art from './image'
import * as page from './pagination'
import * as mutex from '~/utils/lock'
import websub from '~/websub/discovered'
import { UpdateTime, filterTime } from '~/utils/upTimes'
import { sns } from '~/utils/aws'
import type { DBRecord } from 'ddbjs'

export async function parse({ id, feed }: { id: string; feed?: string }) {
  if (!id || !feed) throw Error('must provide podcast id & feed')
  if (!(await mutex.lock(id))) {
    logger.info(`skip parse ${id} (locked)`)
    return
  }

  const times: UpdateTime = {
    lastRequested: new Date(),
  }
  const existing = await db.parser.get(`${id}#parser`)

  const { crc, headers, raw } = await fetchFeed(feed, false, existing)

  times.lastChecked = new Date(headers.get('date'))
  if (crc) times.etag = headers.get('etag')

  const cacheHeaders: DBRecord<typeof db.parser>['cacheHeaders'] = {
    etag: headers.has('etag'),
    lastModified: headers.has('last-modified'),
  }

  if (!raw || (existing?.crc === crc && !process.env.IS_OFFLINE)) {
    await Promise.allSettled([
      mutex.unlock(id),
      db.parser.update(`${id}#parser`, {
        ...filterTime(times),
        ...(crc && (cacheHeaders as any)),
      }),
    ])
    logger.info(`skip parse (${crc ? 'crc matches' : 'no new content'})`)
    return
  }

  times.lastModified = new Date(headers.get('last-modified'))

  const data = await core.invoke(raw)
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
      { remove: removed, times, cacheHeaders }
    )
  )

  await storeMeta(
    data,
    pagination.type === 'none' || hasKnown
      ? { deltaEps: added.length - removed.length }
      : undefined
  )
  await storeEpisodes(added)

  if (pagination.type === 'none' || hasKnown) {
    await mutex.unlock(id)
    if (!existing) await notifyTotal(id, added.length)
    return
  }

  await page.schedule(
    id,
    ...(pagination.type === 'incr' ? [pagination.next] : pagination.pages)
  )
}

export async function parsePage(id: string, pageUrl: string, incr: boolean) {
  if (!id || !pageUrl) throw Error('must provide podcast id & feed')
  logger.info(`parse ${id} ${incr ? 'incremental' : 'batch'} page ${pageUrl}`)
  const { raw } = await fetchFeed(pageUrl)
  if (!raw) throw Error('no content received')

  try {
    const [data, existing] = await Promise.all([
      core.invoke(raw),
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
  await notifyTotal(id, episodes.length)
}

async function storeMeta(data: any, eps?: { deltaEps: number }) {
  logger.info(`store meta ${data.id} (${data.title})`)
  const meta = format.meta(data)
  if (process.env.IS_OFFLINE) Object.assign(meta, await art.fetch(data.id))
  logger.info(meta)
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
    times,
    cacheHeaders,
    ...opts
  }: {
    record?: string
    remove?: string[]
    firstPage?: boolean
    times?: UpdateTime
    cacheHeaders?: DBRecord<typeof db.parser>['cacheHeaders']
  } = {}
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
              lastParsed: new Date().toISOString(),
              ...(data.hub && { websub: { hub: data.hub, self: data.self } }),
              ...(firstPage && times && filterTime(times)),
              ...(cacheHeaders && { cacheHeaders }),
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

async function notifyTotal(podcast: string, total: number) {
  if (process.env.IS_OFFLINE) return
  await sns
    .publish({
      Message: JSON.stringify({ type: 'HAS_TOTAL', podcast, total }),
      TopicArn: process.env.NOTIFY_SNS,
    })
    .promise()
}

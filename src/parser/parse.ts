import 'source-map-support/register'
import { server } from '~/gql/apollo'
import PARSE_QUERY from './gql/parseQuery.gql'
import { print } from 'graphql'
import * as index from '~/utils/podcastindex'
import { numberToId, episodeSK, vowelShift, guidSha1 } from '~/utils/id'
import { sns } from '~/utils/aws'
import { pickKeys } from '~/utils/object'
import fetchArt from '~/utils/fetchArt'
import * as db from '~/utils/db'
import { episodes as eps } from '@picast-app/db'
import { crc32 } from 'crc'
import { DBRecord } from 'ddbjs'

export default async function ({ feed, id }: { feed: string; id: string }) {
  if (!id && !feed) throw Error('must provide feed or id')

  const podProm = db.parser.get(`${id}#parser`)

  feed ??= ((await podProm) ?? (await db.podcasts.get(id)))?.feed
  if (!feed) throw Error(`can't locate feed for ${id}`)

  console.log(`parse ${feed}`)

  const [podcast, pi] = await Promise.all([
    parseFeed(feed),
    !id && index.query('podcasts/byfeedurl', { url: feed }),
  ])

  if (!podcast) throw Error('invalid feed')

  const feedId = id ?? pi?.feed?.id
  if (!feedId) throw "couldn't locate feed"
  podcast.id = numberToId(feedId)
  podcast.feed = feed

  const { crc, episodes } = (await podProm) ?? {}

  async function parsePage(
    url: string,
    retry = 2
  ): Promise<string | undefined> {
    try {
      const page = await parseFeed(url)
      const newEpisodes = page.episodes.filter(
        ({ id }) => !podcast.episodes.find(v => v.id === id)
      )
      podcast.episodes.push(...newEpisodes)
      if (newEpisodes.length > 0)
        return (
          page.nextPage ??
          (podcast.generator?.includes('squarespace.com')
            ? guessNextPage(url)
            : undefined)
        )
    } catch (e) {
      if (retry <= 0) throw e
      await new Promise(res => setTimeout(res, 1000))
      return await parsePage(url, retry - 1)
    }
  }

  if (podcast.generator?.includes('squarespace.com') && !podcast.nextPage)
    podcast.nextPage = guessNextPage(feed)

  let paginated = false
  const maxPage = podcast.hub ? 100 : 10

  if (podcast.lastPage) {
    const pages = guessPageRange(feed, podcast.lastPage).slice(0, maxPage)
    if (pages.length) {
      console.log('parse pages', ...pages)
      paginated = true
      await Promise.all(
        pages.map(page =>
          parsePage(page).catch(e => {
            console.error('failed to parse page', page, e)
          })
        )
      )
    }
  } else {
    let next = podcast.nextPage
    for (let i = 0; i < maxPage && next; i++) {
      console.log('parse page', next)
      try {
        next = await parsePage(next)
        if (next) paginated = true
      } catch (e) {
        console.error('failed to parse', next, e)
        break
      }
    }
  }

  if (crc !== podcast.crc || paginated) await writePodcast(podcast, episodes)
  else console.log('skip write (crc matches)')

  return {
    id: podcast.id,
    title: podcast.title,
    episodes: podcast.episodes.length,
  }
}

const guessNextPage = (url: string) => {
  const next = new URL(url)
  const page = next.searchParams.get('page')
  next.searchParams.set('page', ((page ? parseInt(page) : 1) + 1).toString())
  return next.toString()
}

const guessPageRange = (current: string, end: string) => {
  try {
    const a = new URL(current)
    const b = new URL(end)
    if (a.origin + a.pathname !== b.origin + b.pathname) return []
    const i0 = a.searchParams.has('page')
      ? parseInt(a.searchParams.get('page'))
      : 1
    const ie = parseInt(b.searchParams.get('page'))
    return Array(ie - i0)
      .fill('')
      .map((_, i) => {
        a.searchParams.set('page', (i + i0 + 1).toString())
        return a.toString()
      })
  } catch (e) {
    return []
  }
}

async function parseFeed(feed: string) {
  const { data } = await server.executeOperation({
    query: print(PARSE_QUERY),
    variables: { feed },
  })
  return data.podcast
}

async function writePodcast(podcast: any, known: readonly string[] = []) {
  const meta: Omit<DBRecord<typeof db['podcasts']>, 'id'> = {
    ...pickKeys(
      podcast,
      'title',
      'author',
      'description',
      'subtitle',
      'feed',
      'artwork'
    ),
  }

  let episodes = podcast.episodes.map(
    ({ id: guid, published = 0, ...rest }) => ({
      pId: podcast.id,
      eId: episodeSK(
        vowelShift(parseInt(guidSha1(guid), 16).toString(36)),
        published
      ),
      guid,
      published,
      ...rest,
    })
  )
  const episodeIds = episodes.map(({ eId }) => eId)
  const episodeCheck = eps.hashIds(episodeIds)

  meta.episodeCount = podcast.episodes.length
  meta.check = crc32(JSON.stringify(meta)).toString(36)
  meta.episodeCheck = episodeCheck

  if (process.env.IS_OFFLINE) {
    const covers = await fetchArt(podcast.id)
    if (covers.length) meta.covers = covers
  }

  const old = await db.podcasts.update(podcast.id, meta).returning('OLD')
  episodes.forEach(episode => {
    episode.firstPass = old === undefined
  })

  if (!process.env.IS_OFFLINE && old?.artwork !== meta.artwork)
    processPhotos(podcast.id, meta.artwork)

  const removed = known.filter(id => !episodes.find(({ eId }) => eId === id))
  episodes = episodes.filter(({ eId }) => !known.includes(eId))

  await Promise.all([
    db.episodes.batchPut(...episodes),
    removed.length > 0 &&
      db.episodes.batchDelete(...removed.map(eId => [podcast.id, eId] as any)),
    db.parser.put({
      id: `${podcast.id}#parser`,
      feed: meta.feed,
      crc: podcast.crc,
      lastParsed: Date.now(),
      episodes: episodeIds,
      episodeCheck,
      metaCheck: meta.check,
    }),
  ])
}

async function processPhotos(podcast: string, url: string) {
  await sns
    .publish({
      Message: JSON.stringify({ podcast, url }),
      TopicArn: process.env.RESIZE_SNS,
    })
    .promise()
}

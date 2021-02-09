import 'source-map-support/register'
import { server } from './apollo'
import PARSE_QUERY from './gql/parseQuery.gql'
import { print } from 'graphql'
import * as index from './utils/podcastindex'
import { numberToId, episodeSK, vowelShift, guidSha1 } from './utils/id'
import { sns } from './utils/aws'
import { pickKeys } from './utils/object'
import fetchArt from './utils/fetchArt'
import * as db from './utils/db'
import crc32 from 'crc/crc32'

export default async function ({ feed, id }: { feed: string; id: string }) {
  if (!id && !feed) throw Error('must provide feed or id')

  const podProm = db.parser.get(`${id}#parser`)

  feed ??= ((await podProm) ?? (await db.podcasts.get(id)))?.feed
  if (!feed) throw Error(`can't locate feed for ${id}`)

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

  if (crc !== podcast.crc) await writePodcast(podcast, episodes)

  return {
    id: podcast.id,
    title: podcast.title,
    episodes: podcast.episodes.length,
  }
}

async function parseFeed(feed: string) {
  const { data } = await server.executeOperation({
    query: print(PARSE_QUERY),
    variables: { feed },
  })
  return data.podcast
}

type Meta = Omit<Parameters<typeof db.podcasts.put>[0], 'id'> &
  Record<string, any>

async function writePodcast(podcast: any, known: readonly string[] = []) {
  const meta: Meta = {
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

  meta.episodeCount = podcast.episodes.length
  meta.check = crc32(JSON.stringify(meta)).toString(36)

  const episodes = podcast.episodes
    .map(({ id: guid, published = 0, ...rest }) => ({
      pId: podcast.id,
      eId: episodeSK(
        vowelShift(parseInt(guidSha1(guid), 16).toString(36)),
        published
      ),
      guid,
      published,
      ...rest,
    }))
    .filter(({ eId }) => !known.includes(eId))

  if (process.env.IS_OFFLINE) {
    const covers = await fetchArt(podcast.id)
    if (covers.length) meta.covers = covers
  }

  const old = await db.podcasts.update(podcast.id, meta).returning('OLD')

  if (!process.env.IS_OFFLINE && old?.artwork !== meta.artwork)
    processPhotos(podcast.id, meta.artwork)

  const removed = known.filter(id => !episodes.find(({ eId }) => eId === id))

  await Promise.all([
    db.episodes.batchPut(...episodes),
    removed.length > 0 &&
      db.episodes.batchDelete(...removed.map(eId => [podcast.id, eId] as any)),
    db.parser.put({
      id: `${podcast.id}#parser`,
      feed: meta.feed,
      crc: podcast.crc,
      lastParsed: Date.now(),
      episodes: episodes.map(({ eId }) => eId),
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

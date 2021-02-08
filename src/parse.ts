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

export async function parseFeed(feed: string) {
  console.log('parse', feed)

  const [podcast, pi] = await Promise.all([
    fetchFeed(feed),
    index.query('podcasts/byfeedurl', { url: feed }),
  ])

  const feedId = pi?.feed?.id
  if (!feedId) throw "couldn't locate feed"
  podcast.id = numberToId(feedId)
  podcast.feed = feed

  await writePodcast(podcast)

  return {
    id: podcast.id,
    title: podcast.title,
    episodes: podcast.episodes.length,
  }
}

async function fetchFeed(feed: string) {
  const { data } = await server.executeOperation({
    query: print(PARSE_QUERY),
    variables: { feed },
  })
  return data.podcast
}

type Meta = Parameters<typeof db.podcasts.put>[0] & Record<string, any>

async function writePodcast(podcast: any) {
  const meta: Meta = {
    ...pickKeys(
      podcast,
      'id',
      'title',
      'author',
      'description',
      'subtitle',
      'feed',
      'artwork',
      'covers'
    ),
  }

  meta.episodeCount = podcast.episodes.length
  meta.check = crc32(JSON.stringify(meta)).toString(36)

  const episodes = podcast.episodes.map(
    ({ id: guid, published = 0, ...rest }) => {
      const id = vowelShift(parseInt(guidSha1(guid), 16).toString(36))
      return {
        pId: podcast.id,
        eId: episodeSK(id, published),
        guid,
        published,
        ...rest,
      }
    }
  )

  if (process.env.IS_OFFLINE) meta.covers = await fetchArt(podcast.id)

  const old = await db.podcasts.put(meta).returning('OLD')

  if (!process.env.IS_OFFLINE && old?.artwork !== meta.artwork)
    processPhotos(meta.id, meta.artwork)

  await db.episodes.batchPut(...episodes)
}

async function processPhotos(podcast: string, url: string) {
  await sns
    .publish({
      Message: JSON.stringify({ podcast, url }),
      TopicArn: process.env.RESIZE_SNS,
    })
    .promise()
}

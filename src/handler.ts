import { APIGatewayEvent, SNSEvent } from 'aws-lambda'
import 'source-map-support/register'
import { handler, server } from './apollo'
import wrap from './utils/handler'
import PARSE_QUERY from './gql/parseQuery.gql'
import { print } from 'graphql'
import * as index from './utils/podcastindex'
import { numberToId, episodeSK, vowelShift, guidSha1 } from './utils/id'
import { ddb, sns } from './utils/aws'
import { pickKeys } from './utils/object'
import * as arr from './utils/array'
import fetchArt from './utils/fetchArt'
import * as db from './utils/db'
import crc32 from 'crc/crc32'

export const graph = handler

export const parse = wrap<APIGatewayEvent | SNSEvent>(async event => {
  const feeds: string[] = []

  if ('Records' in event) {
    feeds.push(...event.Records.map(({ Sns }) => JSON.parse(Sns.Message).feed))
  } else {
    const { feed } = JSON.parse(event.body) ?? {}
    if (!feed) throw 'missing feed'
    feeds.push(feed)
  }

  const [res] = await Promise.all(feeds.map(parseFeed))

  if ('Records' in event) return
  return res
})

async function parseFeed(feed: string) {
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

async function writePodcast(podcast: Meta & any) {
  const meta: Meta = {
    ...pickKeys(
      podcast,
      'id',
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

  if (process.env.IS_OFFLINE) {
    const covers = await fetchArt(podcast.id)
    if (covers?.length) meta.art = covers
  }

  const { Attributes } = await ddb
    .put({
      TableName: 'echo_podcasts',
      Item: meta,
      ReturnValues: 'ALL_OLD',
    })
    .promise()

  if (!process.env.IS_OFFLINE && Attributes?.artwork !== meta.artwork)
    await sns
      .publish({
        Message: JSON.stringify({
          podcast: meta.id,
          url: meta.artwork,
        }),
        TopicArn: process.env.RESIZE_SNS,
      })
      .promise()

  const batches = arr.batch(episodes, 25)

  for (const batch of batches) {
    console.log(`batch ${batches.indexOf(batch) + 1} / ${batches.length}`)
    console.log(
      await ddb
        .batchWrite({
          RequestItems: {
            echo_episodes: batch.map(Item => ({ PutRequest: { Item } })),
          },
        })
        .promise()
    )
  }
}

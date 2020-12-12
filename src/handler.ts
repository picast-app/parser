import { APIGatewayEvent, SNSEvent } from 'aws-lambda'
import 'source-map-support/register'
import { handler, server } from './apollo'
import wrap from './utils/handler'
import PARSE_QUERY from './gql/parseQuery.gql'
import { print } from 'graphql'
import * as index from './utils/podcastindex'
import { numberToId, episodeSK, vowelShift, guidSha1 } from './utils/id'
import { ddb } from './utils/aws'
import { pickKeys } from './utils/object'
import * as arr from './utils/array'

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

async function writePodcast(podcast: any) {
  const meta = {
    id: podcast.id,
    ...pickKeys(podcast, [
      'id',
      'title',
      'author',
      'description',
      'subtitle',
      'feed',
      'artwork',
    ]),
    episodeCount: podcast.episodes?.length ?? 0,
  }

  const episodes = podcast.episodes.map(
    ({ id: guid, published = 0, ...rest }) => {
      const id = guidSha1(guid)
      return {
        pId: podcast.id,
        eId: episodeSK(id, published),
        id: vowelShift(parseInt(id, 16).toString(36)),
        guid,
        published,
        ...rest,
      }
    }
  )

  await ddb.put({ TableName: 'echo_podcasts', Item: meta }).promise()

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

import { APIGatewayEvent } from 'aws-lambda'
import 'source-map-support/register'
import { handler, server } from './apollo'
import wrap from './utils/handler'
import PARSE_QUERY from './gql/parseQuery.gql'
import { print } from 'graphql'
import * as index from './utils/podcastindex'
import { numberToId, episodeSK } from './utils/id'
import { ddb } from './utils/aws'
import { pickKeys } from './utils/object'
import * as arr from './utils/array'

export const graph = handler

export const parse = wrap<APIGatewayEvent>(async event => {
  const { feed } = JSON.parse(event.body) ?? {}
  if (!feed) throw 'missing feed'

  const [podcast, pi] = await Promise.all([
    fetchFeed(feed),
    index.query('podcasts/byfeedurl', { url: feed }),
  ])

  const feedId = pi?.feed?.id
  if (!feedId) throw "couldn't locate feed"
  podcast.id = numberToId(feedId)

  await writePodcast(podcast)

  return {
    id: podcast.id,
    title: podcast.title,
    episodes: podcast.episodes.length,
  }
})

async function fetchFeed(feed: string) {
  const { data } = await server.executeOperation({
    query: print(PARSE_QUERY),
    variables: { feed },
  })
  return data.podcast
}

async function writePodcast(podcast: any) {
  const items = [
    {
      pk: podcast.id,
      sk: 'meta',
      ...pickKeys(podcast, ['id', 'title', 'description', 'subtitle']),
    },
  ]
  for (const { id, published = 0, ...rest } of podcast.episodes)
    items.push({
      pk: podcast.id,
      sk: episodeSK(id, published),
      published,
      ...rest,
    })

  for (const batch of arr.batch(items, 25)) {
    console.log(
      await ddb
        .batchWrite({
          RequestItems: {
            echo_main: batch.map(Item => ({ PutRequest: { Item } })),
          },
        })
        .promise()
    )
  }
}

import { APIGatewayEvent } from 'aws-lambda'
import 'source-map-support/register'
import { handler, server } from './apollo'
import wrap from './utils/handler'
import PARSE_QUERY from './gql/parseQuery.gql'
import { print } from 'graphql'

export const graph = handler

export const parse = wrap<APIGatewayEvent>(async event => {
  const { feed } = JSON.parse(event.body) ?? {}
  if (!feed) throw 'missing feed'

  const podcast = await fetchFeed(feed)

  return {
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

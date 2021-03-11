import { server } from '~/gql/apollo'
import PARSE_QUERY from '~/gql/parseQuery.gql'
import { print } from 'graphql'

export async function parse(feed: string) {
  const { data } = await server.executeOperation({
    query: print(PARSE_QUERY),
    variables: { feed },
  })
  return data.podcast
}

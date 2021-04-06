import { server } from '~/core/server'
import PARSE_QUERY from '~/core/schema/fullQuery.gql'
import { print } from 'graphql'

export async function parse(feed: string) {
  const { data } = await server.executeOperation({
    query: print(PARSE_QUERY),
    variables: { feed },
  })
  return data?.podcast
}

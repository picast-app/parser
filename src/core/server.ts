import '~/utils/logger'
import { ApolloServer, makeExecutableSchema } from 'apollo-server-lambda'
import * as resolvers from '~/core/resolvers'
import * as typeDefs from '~/core/schema'
import { Headers } from '~/utils/http'
import QUERY from './schema/fullQuery.gql'
import { print } from 'graphql'
import type {
  APIGatewayEvent,
  Context,
  APIGatewayProxyCallback,
} from 'aws-lambda'

export const requests = {}

export const schema = makeExecutableSchema({
  typeDefs: Object.values(typeDefs),
  resolvers,
  inheritResolversFromInterfaces: true,
})

export const server = new ApolloServer({
  schema,
  debug: !!process.env.IS_OFFLINE,
  introspection: true,
  playground: {
    endpoint: '/',
    settings: {
      'request.credentials': 'same-origin',
      'editor.fontFamily':
        "'Consolas', 'Inconsolata', 'Droid Sans Mono', 'Monaco', monospace",
      // @ts-ignore
      'schema.polling.enable': false,
    },
  },
  engine: false,
})

const _handler = server.createHandler()

export const handler = (event: any, ctx: any, cb: any) => {
  logger.info(`invoke ${'requestContext' in event ? 'gateway' : 'direct'}`)
  if ('requestContext' in event) httpHandler(event, ctx, cb)
  else directHandler(event).then(v => cb(null, v))
}

function httpHandler(
  event: APIGatewayEvent,
  ctx: Context,
  cb: APIGatewayProxyCallback
) {
  if (
    new Headers(event.headers).get('auth') !== process.env.PARSER_AUTH &&
    !process.env.IS_OFFLINE
  )
    return { statusCode: 401 }
  return _handler(event, ctx, cb)
}

const directHandler = async (event: any) =>
  await server.executeOperation({
    query: print(QUERY),
    variables: { raw: event.raw },
  })

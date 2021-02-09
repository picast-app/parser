import { ApolloServer, makeExecutableSchema } from 'apollo-server-lambda'
import * as resolvers from './resolvers'
import * as typeDefs from './schema'

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

export const handler = async (event, ...args) => {
  if (event.headers.Auth !== process.env.PARSER_AUTH && !process.env.IS_OFFLINE)
    return { statusCode: 401 }
  // @ts-ignore
  return await _handler(event, ...args)
}

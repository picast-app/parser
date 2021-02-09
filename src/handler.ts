import { APIGatewayEvent, SNSEvent } from 'aws-lambda'
import 'source-map-support/register'
import { handler } from './apollo'
import wrap from './utils/handler'
import parseFeed from './parse'

export const graph = handler

export const parse = wrap<APIGatewayEvent | SNSEvent>(async event => {
  const feeds: { feed: string; id?: string }[] = []

  if ('Records' in event) {
    feeds.push(...event.Records.map(({ Sns }) => JSON.parse(Sns.Message)))
  } else {
    if (event.headers.Auth !== process.env.PARSER_AUTH)
      return {
        statusCode: 401,
      }
    feeds.push(JSON.parse(event.body) ?? {})
  }

  const [res] = await Promise.all(feeds.map(parseFeed))

  if ('Records' in event) return
  return res
})

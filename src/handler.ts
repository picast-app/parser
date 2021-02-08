import { APIGatewayEvent, SNSEvent } from 'aws-lambda'
import 'source-map-support/register'
import { handler } from './apollo'
import wrap from './utils/handler'
import { parseFeed } from './parse'

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

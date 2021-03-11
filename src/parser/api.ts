import '~/utils/logger'
import wrap from '~/utils/handler'
import { parse } from './parse'
import { Headers } from '~/utils/http'
import type { SNSEvent, APIGatewayEvent } from 'aws-lambda'

export const parsePodcast = wrap<SNSEvent>(async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
  const tasks = parseMessages(event)
  const results = await Promise.allSettled(tasks.map(parse))

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error('parse failed', result.reason)
    }
  }
})

function parseMessages(event: SNSEvent) {
  const tasks: any[] = []
  for (const { Sns } of event.Records) {
    try {
      tasks.push(JSON.parse(Sns.Message))
    } catch (e) {
      logger.error('failed to parse', Sns?.Message, e)
    }
  }
  return tasks
}

export const httpWrap = wrap<APIGatewayEvent>(async (event, ...args) => {
  logger.info(event)
  if (new Headers(event.headers).get('auth') !== process.env.PARSER_AUTH)
    throw 401

  // @ts-ignore
  await parsePodcast({ Records: [{ Sns: { Message: event.body } }] }, ...args)
})

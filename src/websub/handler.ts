import '~/utils/logger'
import { DynamoDB } from 'aws-sdk'
import * as db from '~/utils/db'
import axios from 'axios'
import crypto from 'crypto'
import type { DBRecord } from 'ddbjs'
import type { DynamoDBStreamEvent, APIGatewayEvent } from 'aws-lambda'

export async function dbUpdate(event: DynamoDBStreamEvent) {
  const tasks: Promise<any>[] = []

  for (const record of event.Records) {
    logger.info(record)
    if (record.eventName !== 'INSERT' || !record.dynamodb?.NewImage) continue
    const item: DBRecord<typeof db['websub']> = DynamoDB.Converter.unmarshall(
      record.dynamodb.NewImage
    ) as any
    if (item.status !== 'pending') continue
    tasks.push(subscribe(item))
  }

  const results = await Promise.allSettled(tasks)
  for (const result of results)
    if (result.status === 'rejected') logger.error(result.reason)
}

async function subscribe(record: DBRecord<typeof db['websub']>) {
  logger.info('subscribe', record)

  const secret = crypto.randomBytes(20).toString('hex')
  await db.websub.update(record.podcast, { status: 'requested', secret })

  const params = new URLSearchParams()
  params.set('hub.mode', 'subscribe')
  params.set('hub.topic', record.topic)
  params.set('hub.callback', `https://sub.picast.app/${record.podcast}`)
  params.set('hub.secret', secret)

  const response = await axios.post(record.hub, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  if (response.status < 400) return logger.info('request successful')

  await db.websub
    .update(record.podcast, { status: 'rejected' })
    .remove('secret')
  throw response.statusText
}

export async function pushHandler(event: APIGatewayEvent) {
  logger.info(event)
  await new Promise(res => setTimeout(res, 500))
  return {
    statusCode: 200,
  }
}

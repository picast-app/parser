import '~/utils/logger'
import { DynamoDB } from 'aws-sdk'
import * as db from '~/utils/db'
import axios from 'axios'
import crypto from 'crypto'
import { pickKeys as pick } from '~/utils/object'
import { wrap } from './util'
import type { DBRecord } from 'ddbjs'
import type { DynamoDBStreamEvent } from 'aws-lambda'

export async function dbUpdate(event: DynamoDBStreamEvent) {
  const tasks: Promise<any>[] = []

  for (const record of event.Records) {
    if (record.eventName !== 'INSERT' || !record.dynamodb?.NewImage) continue
    const item: DBRecord<typeof db['websub']> = DynamoDB.Converter.unmarshall(
      record.dynamodb.NewImage
    ) as any
    if (item.status !== 'pending') continue
    tasks.push(subscribe(item))
  }

  const results = await Promise.allSettled(tasks)
  for (const result of results)
    if (result.status === 'rejected') logger.error('task rejected', result)
}

async function subscribe(record: DBRecord<typeof db['websub']>) {
  logger.info('subscribe', record)

  const secret = crypto.randomBytes(20).toString('hex')
  await db.websub.update(record.podcast, {
    status: 'requested',
    secret,
    requested: Date.now(),
  })

  const params = new URLSearchParams()
  params.set('hub.mode', 'subscribe')
  params.set('hub.topic', record.topic)
  params.set('hub.callback', `https://sub.picast.app/${record.podcast}`)
  params.set('hub.secret', secret)

  const response = await axios.post(record.hub, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  if (response.status < 400) return logger.info('request successful')
  logger.warn('failed to setup websub subscription')

  await Promise.all([
    db.websub.update(record.podcast, { status: 'rejected' }).remove('secret'),
    db.parser.update(`${record.podcast}#parser`).remove('websub'),
  ])
  throw response.statusText
}

const MIN_LEASE = 12 * 60 ** 2

export const challenge = wrap(async event => {
  logger.info(
    `challenge to ${event.pathParameters.id}`,
    pick(event, 'headers', 'queryStringParameters', 'pathParameters')
  )

  const {
    'hub.lease_seconds': lease,
    'hub.mode': mode,
    'hub.challenge': challenge,
  } = event.queryStringParameters
  let duration = parseInt(lease)
  if (isNaN(duration)) duration = -Infinity

  if (mode !== 'subscribe') throw Error(`unexpected mode ${mode}`)
  if (duration < MIN_LEASE) throw Error(`invalid lease duration ${duration}`)
  if (!challenge) throw Error('missing challenge')

  const record = await db.websub.get(event.pathParameters.id)
  if (!record) throw Error('unrequested')

  const issued = Date.now()
  const expires = record.requested + duration * 1000
  const renewAt = Math.max(
    expires - 30 * 60 * 1000,
    issued + (expires - issued) / 10
  )

  await db.websub.update(event.pathParameters.id, {
    status: 'active',
    issued,
    expires,
    ttl: Math.floor(renewAt / 1000),
  })

  logger.info('challenge completed')
  return challenge
})

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
    if (record.eventName === 'INSERT') {
      const item: DBRecord<typeof db['websub']> = DynamoDB.Converter.unmarshall(
        record.dynamodb!.NewImage!
      ) as any
      if (item.status !== 'pending') continue
      tasks.push(subscribe(item))
    } else if (record.eventName === 'REMOVE') {
      logger.info('removed', record.dynamodb)
      const item: DBRecord<typeof db['websub']> = DynamoDB.Converter.unmarshall(
        record.dynamodb!.OldImage!
      ) as any
      if (item.status === 'active') {
        logger.info('renew subscription')
        await subscribe(item, true)
      } else {
        if ((item as any).attempts >= 3) {
          logger.warn('failed to setup or confirm subscription')
          await cleanup(item.podcast)
        } else {
          await subscribe(item)
        }
      }
    }
  }

  const results = await Promise.allSettled(tasks)
  for (const result of results)
    if (result.status === 'rejected') logger.error('task rejected', result)
}

async function subscribe(
  record: DBRecord<typeof db['websub']>,
  resetAttempts = false
) {
  logger.info('subscribe', record)

  const secret = crypto.randomBytes(20).toString('hex')
  let q = db.websub.update(record.podcast, {
    status: 'requested',
    secret,
    requested: Date.now(),
    ttl: Math.floor(Date.now() / 1000) + 60 ** 2,
    ...(resetAttempts && { attempts: 1 }),
  })
  if (!resetAttempts) q = q.add({ attempts: 1 })
  await q

  const params = new URLSearchParams()
  params.set('hub.mode', 'subscribe')
  params.set('hub.topic', record.topic!)
  params.set('hub.callback', `https://sub.picast.app/${record.podcast}`)
  params.set('hub.secret', secret)

  const response = await axios.post(record.hub!, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  if (response.status < 400) return logger.info('request successful')
  logger.warn('failed to setup websub subscription')

  await cleanup(record.podcast)
  throw response.statusText
}

async function cleanup(podcast: string) {
  await Promise.all([
    db.websub.update(podcast, { status: 'rejected' }).remove('secret'),
    db.parser.update(`${podcast}#parser`).remove('websub'),
  ])
}

const MIN_LEASE = 12 * 60 ** 2

export const challenge = wrap(async event => {
  logger.info(
    `challenge to ${event.pathParameters!.id}`,
    pick(event, 'headers', 'queryStringParameters', 'pathParameters')
  )

  const {
    'hub.lease_seconds': lease,
    'hub.mode': mode,
    'hub.challenge': challenge,
  } = event.queryStringParameters!
  let duration = parseInt(lease)
  if (isNaN(duration)) duration = -Infinity

  if (mode !== 'subscribe') throw Error(`unexpected mode ${mode}`)
  if (duration < MIN_LEASE) throw Error(`invalid lease duration ${duration}`)
  if (!challenge) throw Error('missing challenge')

  const record = await db.websub.get(event.pathParameters!.id)
  if (!record) throw Error('unrequested')

  const issued = Date.now()
  const expires = record.requested + duration * 1000
  const renewAt = Math.max(
    expires - 30 * 60 * 1000,
    issued + (expires - issued) / 10
  )

  await db.websub.update(event.pathParameters!.id, {
    status: 'active',
    issued,
    expires,
    ttl: Math.floor(renewAt / 1000),
  })

  logger.info('challenge completed')
  return challenge
})

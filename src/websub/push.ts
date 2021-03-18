import '~/utils/logger'
import * as gql from '~/parser/gql'
import { storePartial } from '~/utils/fetchFeed'
import { pickKeys as pick } from '~/utils/object'
import { wrap } from './util'
import { Headers } from '~/utils/http'
import * as format from '~/parser/format'
import * as db from '~/utils/db'
import cyrpto from 'crypto'

export const handler = wrap(async event => {
  logger.info(
    `push to ${event.path}`,
    pick(event, 'pathParameters', 'body', 'headers')
  )

  const record = await db.websub.get(event.pathParameters.id)
  const headers = new Headers(event.headers)
  verifySignature(record.secret, headers.get('X-Hub-Signature'), event.body)

  const [data, parserMeta] = await Promise.all([
    gql.parse(storePartial(event.body)),
    db.parser.get(`${event.pathParameters.id}#parser`),
  ])
  if (!parserMeta) throw Error(`unknown podcast ${event.pathParameters.id}`)

  const episodes = format
    .episodes(data, false, event.pathParameters.id)
    .filter(({ eId }) => !parserMeta.episodes?.includes(eId))
  if (!episodes.length) return

  const newIds = episodes.map(({ eId }) => eId)
  const episodeCheck = format.episodeCheck([
    ...(parserMeta.episodes ?? []),
    ...newIds,
  ])

  logger.info({ episodes, newIds, episodeCheck })

  await Promise.all([
    db.parser
      .update(`${event.pathParameters.id}#parser`, { episodeCheck })
      .add({ episodes: newIds }),
    db.episodes.batchPut(...episodes),
  ])
}, 200)

function verifySignature(secret: string, sigStr: string, data: string) {
  if (!secret) throw Error('secret missing')
  if (!sigStr) throw Error('signature missing')
  sigStr = sigStr.trim().toLowerCase()
  if (!/^(sha1|sha256|sha384|sha512)=[0-9a-f]+$/.test(sigStr))
    throw Error('invalid signature format')
  const [method, signature] = sigStr.split('=')
  if (
    cyrpto.createHmac(method, secret).update(data).digest('hex') !== signature
  )
    throw Error('invalid signature')
}

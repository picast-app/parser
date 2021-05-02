import * as obj from '~/utils/object'
import { episodeSK, vowelShift, guidSha1 } from '~/utils/id'
import { episodes as eps, meta as dbMeta } from '@picast-app/db'
import type * as db from '~/utils/db'
import type { DBRecord } from 'ddbjs'

export const episodes = (podcast: any, firstPass = false, pId = podcast.id) =>
  podcast.episodes.map(({ id: guid, published, ...rest }) => ({
    pId,
    eId: episodeSK(
      vowelShift(parseInt(guidSha1(guid), 16).toString(36)),
      new Date(published)
    ),
    guid,
    published,
    ...(firstPass && { firstPass }),
    ...rest,
  }))

export const episodeCheck = (episodes: string[]) => eps.hashIds(episodes)

export const meta = (data: any): DBRecord<typeof db.podcasts> => {
  const meta: any = obj.pickKeys(
    data,
    'feed',
    'title',
    'author',
    'description',
    'subtitle',
    'artwork',
    'crc',
    'episodeCheck'
  )
  return { ...meta, metaCheck: dbMeta.check(meta) }
}

import * as obj from '~/utils/object'
import { episodeSK, vowelShift, guidSha1 } from '~/utils/id'
import { episodes as eps, meta as dbMeta } from '@picast-app/db'

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

export const meta = (data: any) => {
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
  return { ...meta, check: dbMeta.check(meta) }
}

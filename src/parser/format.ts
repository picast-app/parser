import * as obj from '~/utils/object'
import { crc32 } from 'crc'
import { episodeSK, vowelShift, guidSha1 } from '~/utils/id'
import { episodes as eps } from '@picast-app/db'

export const episodes = (podcast: any, firstPass = false, pId = podcast.id) =>
  podcast.episodes.map(({ id: guid, published = 0, ...rest }) => ({
    pId,
    eId: episodeSK(
      vowelShift(parseInt(guidSha1(guid), 16).toString(36)),
      published
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
    'artwork'
  )
  meta.check = crc32(JSON.stringify(meta)).toString(36)
  Object.assign(meta, obj.pickKeys(data, 'crc', 'episodeCheck'))
  return meta
}

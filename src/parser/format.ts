import * as obj from '~/utils/object'
import { crc32 } from 'crc'
import { episodeSK, vowelShift, guidSha1 } from '~/utils/id'
import { episodes as eps } from '@picast-app/db'

export const episodes = (podcast: any, firstPass = false) =>
  podcast.episodes.map(({ id: guid, published = 0, ...rest }) => ({
    pId: podcast.id,
    eId: episodeSK(
      vowelShift(parseInt(guidSha1(guid), 16).toString(36)),
      published
    ),
    guid,
    published,
    ...(firstPass && { firstPass }),
    ...rest,
  }))

export const episodeCheck = (episodes: any[]) => ({
  episodeCount: episodes.length,
  episodeCheck: eps.hashIds(episodes.map(({ id }) => id)),
})

export const meta = (data: any, episodes?: any[]) => {
  const meta: any = obj.pickKeys(
    data,
    'feed',
    'crc',
    'title',
    'author',
    'description',
    'subtitle',
    'artwork'
  )
  meta.check = crc32(JSON.stringify(meta)).toString(36)
  if (episodes) Object.assign(meta, episodeCheck(episodes))
  return meta
}

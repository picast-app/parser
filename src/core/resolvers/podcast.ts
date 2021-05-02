import { buildSelector } from '~/core/xml/selector'
import * as pi from '~/utils/podcastindex'

type Parent = {
  channel: Element
  episodes: Element[]
}

const $ = buildSelector(({ channel }: Parent) => channel)

const episodes = ({ episodes }: Parent, { limit }) =>
  episodes.slice(0, limit ?? Infinity)

const index = async ({ feed }) =>
  JSON.stringify(await pi.query('podcasts/byfeedurl', { url: feed }))

// prettier-ignore
export default {
  title:        $`> title`.strip,

  author:       $`> itunes:author`.strip,

  description:  $`> description
                  > itunes:summary`.strip,

  artwork:      $`> image url
                  > itunes:image.href`,

  generator:    $`> generator`,

  nextPage:     $`> :link[rel='next'].href`,
  lastPage:     $`> :link[rel='last'].href`,

  hub:          $`> :link[rel='hub'].href`,
  self:          $`> :link[rel='self'].href`,

  episodes,
  index
}

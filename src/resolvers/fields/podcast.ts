import { buildSelector } from '~/utils/selector'
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

  subtitle:     $`> subtitle`.strip,

  artwork:      $`> image url
                  > itunes:image.href`,

  generator:    $`> generator`,

  nextPage:     $`> atom:link[rel='next'].href`,
  lastPage:     $`> atom:link[rel='last'].href`,

  hub:          $`> atom:link[rel='hub'].href`,
  self:          $`> atom:link[rel='self'].href`,

  episodes,
  index
}

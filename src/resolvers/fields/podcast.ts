import { buildSelector } from '~/utils/selector'

type Parent = {
  channel: Element
  episodes: Element[]
}

const $ = buildSelector(({ channel }: Parent) => channel)

const episodes = ({ episodes }: Parent, { limit }) =>
  episodes.slice(0, limit ?? Infinity)

// prettier-ignore
export default {
  title:        $`> title`.strip,

  description:  $`> description
                  > itunes:summary`.strip,

  subtitle:     $`> subtitle`.strip,

  episodes,
}

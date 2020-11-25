import { query } from '~/utils/dom'

type Parent = {
  channel: Element
  episodes: Element[]
}

const $ = (selects: TemplateStringsArray) => ({ channel }: Parent) =>
  query(channel, ...selects[0].split('\n'))

const episodes = ({ episodes }: Parent, { limit }) =>
  episodes.slice(0, limit ?? Infinity)

// prettier-ignore
export default {
  title:        $`> title`,

  description:  $`> description
                  > itunes:summary`,

  subtitle:     $`> subtitle`,

  episodes,
}

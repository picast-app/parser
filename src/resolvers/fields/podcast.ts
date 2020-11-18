import { query } from '~/utils/dom'

type Parent = {
  channel: Element
  episodes: Element[]
}

const $ = (selects: TemplateStringsArray) => ({ channel }: Parent) =>
  query(channel, ...selects[0].split('\n'))

export const episodes = ({ episodes }: Parent, { limit }) =>
  episodes.slice(0, limit ?? Infinity)

export const title = $`> title`

export const description = $`
  > description
  > itunes:summary
`

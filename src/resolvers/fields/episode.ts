import { query } from '~/utils/dom'

const $ = (selects: TemplateStringsArray) => (episode: Element) =>
  query(episode, ...selects[0].split('\n'))

export const id = $`
  > guid
  > enclosure.url
`

export const title = $`> title`

export const url = $`> enclosure.url`

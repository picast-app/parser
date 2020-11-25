import { query } from '~/utils/dom'

const $ = (selects: TemplateStringsArray) => {
  let mod = v => v
  const exec = (episode: Element) =>
    mod(query(episode, ...selects[0].split('\n')))
  return Object.defineProperties(exec, {
    time: {
      get() {
        mod = v => (new Date(v).getTime() / 1000) | 0
        return this
      },
    },
  })
}

// prettier-ignore
export default {
  id:         $`> guid
                > enclosure.url`,
            
  title:      $`> title`,

  url:        $`> enclosure.url`,

  shownotes:  $`> body
                > content:encoded
                > fullitem
                > atom10:content`,

  published:  $`> pubDate`.time
}

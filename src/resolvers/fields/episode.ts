import { buildSelector } from '~/utils/selector'

const $ = buildSelector((episode: Element) => episode)

// prettier-ignore
export default {
  id:         $`> guid
                > enclosure.url`,
            
  title:      $`> title`.strip,

  url:        $`> enclosure.url`,

  shownotes:  $`> body
                > content:encoded
                > fullitem
                > atom10:content`,

  published:  $`> pubDate`.time,

  duration:   $`> itunes:duration`.duration
}

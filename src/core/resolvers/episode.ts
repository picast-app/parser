import { buildSelector } from '~/core/selector'

const $ = buildSelector((episode: Element) => episode)

// prettier-ignore
export default {
  id:         $`> guid
                > enclosure.url
                > id`,
            
  title:      $`> title`.strip,

  url:        $`> enclosure.url
                > link[rel='enclosure'].href`,

  shownotes:  $`> body
                > content:encoded
                > fullitem
                > atom10:content
                > description
                > content
                > summary`,

  published:  $`> pubDate
                > published`.time,

  duration:   $`> itunes:duration`.duration
}

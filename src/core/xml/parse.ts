import { performance } from 'perf_hooks'
import { JSDOM } from 'jsdom'

export default function parse(txt: string) {
  const t0 = performance.now()

  const { document } = new JSDOM(txt, { contentType: 'text/xml' }).window

  const channel =
    document.querySelector('channel') ?? document.querySelector('feed')
  if (!channel) throw Error("feed doesn't contain a channel or feed element")

  const episodes = [
    ...channel.querySelectorAll(':scope > item'),
    ...channel.querySelectorAll(':scope > entry'),
  ]
  episodes.forEach(node => node.remove())

  logger.info(`parsed in ${Math.round(performance.now() - t0)}ms`)

  return { channel, episodes }
}

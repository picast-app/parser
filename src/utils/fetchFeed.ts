import axios from 'axios'
import { JSDOM } from 'jsdom'
import crc32 from 'crc/crc32'

type Parsed = {
  raw: string
  crc: string
  channel: Element
  episodes: Element[]
}

const cache: Record<string, Promise<Parsed>> = {}

export default async function fetchFeed(url: string, useCache = true) {
  logger.info(`fetch feed ${url}` + (useCache ? ' from cache' : ''))
  if (!useCache || !(url in cache)) cache[url] = fetch(url).then(parseFeed)
  return cache[url]
}

export function storePartial(raw: string) {
  const parsed = parseFeed(raw)
  cache[parsed.crc] ??= Promise.resolve(parsed)
  return parsed.crc
}

const fetch = async (url: string): Promise<string> => {
  try {
    const { data } = await axios.get(url)
    return data
  } catch (e) {
    logger.error('failed to fetch', url, e)
    throw e
  }
}

const parseFeed = (raw: string): Parsed => {
  const { document } = new JSDOM(raw, { contentType: 'text/xml' }).window

  const channel =
    document.querySelector('channel') ?? document.querySelector('feed')
  if (!channel) throw Error("feed doesn't contain a channel or feed element")

  const episodes = [
    ...channel.querySelectorAll(':scope > item'),
    ...channel.querySelectorAll(':scope > entry'),
  ]
  episodes.forEach(node => node.remove())

  return {
    raw,
    crc: crc32(raw).toString(16),
    channel,
    episodes,
  }
}

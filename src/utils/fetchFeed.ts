import axios from 'axios'
import { JSDOM } from 'jsdom'
import crc32 from 'crc/crc32'
import { Headers } from './http'

type Parsed = {
  raw: string
  crc: string
  channel: Element
  episodes: Element[]
  headers: Headers
}

const cache: Record<string, Promise<Parsed>> = {}

export default async function fetchFeed(url: string, useCache = true) {
  logger.info(`fetch feed ${url}` + (useCache ? ' from cache' : ''))
  if (!useCache || !(url in cache))
    cache[url] = fetch(url).then(([txt, headers]) => parseFeed(txt, headers))
  return cache[url]
}

export function storePartial(raw: string, headers: Headers) {
  const parsed = parseFeed(raw, headers)
  cache[parsed.crc] ??= Promise.resolve(parsed)
  return parsed.crc
}

const fetch = async (url: string): Promise<[string, Headers]> => {
  try {
    const { data, headers } = await axios.get(url)
    return [data, new Headers(headers)]
  } catch (e) {
    logger.error('failed to fetch', url, e)
    throw e
  }
}

const parseFeed = (raw: string, headers: Headers): Parsed => {
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
    headers,
  }
}

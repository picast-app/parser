import axios from 'axios'
import { JSDOM } from 'jsdom'
import crc32 from 'crc/crc32'
import { Headers } from './http'
import type { DBRecord } from 'ddbjs'
import type { parser } from '~/utils/db'
import { performance } from 'perf_hooks'

type Parsed = {
  raw?: string
  crc?: string
  channel?: Element
  episodes?: Element[]
  headers: Headers
}

const cache: Record<string, Promise<Parsed>> = {}

export default async function fetchFeed(
  url: string,
  useCache = true,
  record?: DBRecord<typeof parser>
): Promise<Parsed> {
  logger.info(`fetch feed ${url}` + (useCache ? ' from cache' : ''))
  if (!useCache || !(url in cache)) {
    let cacheConds: {
      'If-Modified-Since'?: string
      'If-None-Match'?: string
    } = {}
    if (record) {
      if (record.cacheHeaders?.lastModified || !record.cacheHeaders?.etag)
        cacheConds['If-Modified-Since'] =
          record.lastModified ?? record.lastChecked
      else cacheConds['If-None-Match'] = record.etag
      cacheConds = Object.fromEntries(
        Object.entries(cacheConds).filter(([, v]) => v)
      )
    }
    cache[url] = fetch(url, cacheConds).then(res => parseFeed(...res))
  }
  return cache[url]
}

export function storePartial(raw: string, headers: Headers) {
  const parsed = parseFeed(raw, headers)
  cache[parsed.crc!] ??= Promise.resolve(parsed)
  return parsed.crc
}

const fetch = async (
  url: string,
  headers: Record<string, string | undefined> = {}
): Promise<[string | null, Headers]> => {
  try {
    const { data, headers: resHeads } = await axios.get(
      url,
      Object.keys(headers ?? {}).length ? { headers } : undefined
    )
    return [data ?? null, new Headers(resHeads)]
  } catch (e) {
    if (e.response?.status !== 304) throw e
    logger.info('304: Not Modified')
    return [null, new Headers(e.response.headers)]
  }
}

const parseFeed = (raw: string | null, headers: Headers): Parsed => {
  if (!raw) return { headers }
  const t0 = performance.now()
  const { document } = new JSDOM(raw, { contentType: 'text/xml' }).window

  const channel =
    document.querySelector('channel') ?? document.querySelector('feed')
  if (!channel) throw Error("feed doesn't contain a channel or feed element")

  const episodes = [
    ...channel.querySelectorAll(':scope > item'),
    ...channel.querySelectorAll(':scope > entry'),
  ]
  episodes.forEach(node => node.remove())

  logger.info(`parsed in ${Math.round(performance.now() - t0)}ms`)

  return {
    raw,
    crc: crc32(raw).toString(16),
    channel,
    episodes,
    headers,
  }
}

import axios from 'axios'
import crc32 from 'crc/crc32'
import { Headers } from './http'
import type { DBRecord } from 'ddbjs'
import type { parser } from '~/utils/db'

type Parsed = {
  raw: string | null
  crc?: string
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
    cache[url] = fetch(url, cacheConds).then(([raw, headers]) => ({
      raw,
      headers,
      ...(raw && { crc: crc32(raw).toString(16) }),
    }))
  }
  return cache[url]
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

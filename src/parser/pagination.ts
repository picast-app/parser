import { Lambda } from 'aws-sdk'
import * as lock from '~/utils/lock'

type PageOpts =
  | { type: 'none' }
  | { type: 'incr'; next: string }
  | { type: 'set'; pages: string[] }

export const opts = (data: any): PageOpts => {
  if (data.lastPage)
    return {
      type: 'set',
      pages: guessPageRange(data.feed, data.lastPage),
    }

  if (data.nextPage)
    return {
      type: 'incr',
      next: data.nextPage,
    }

  if (data.generator?.includes('squarespace')) {
    return {
      type: 'incr',
      next: guessNextPage(data.feed),
    }
  }

  return { type: 'none' }
}

export const guessNextPage = (url: string) => {
  const next = new URL(url)
  const page = next.searchParams.get('page')
  next.searchParams.set('page', ((page ? parseInt(page) : 1) + 1).toString())
  return next.toString()
}

const guessPageRange = (current: string, end: string) => {
  logger.info({ current, end })
  try {
    const a = new URL(current)
    const b = new URL(end)
    if (a.origin + a.pathname !== b.origin + b.pathname) return []
    const i0 = a.searchParams.has('page')
      ? parseInt(a.searchParams.get('page'))
      : 1
    const ie = parseInt(b.searchParams.get('page'))
    return Array(ie - i0)
      .fill('')
      .map((_, i) => {
        a.searchParams.set('page', (i + i0 + 1).toString())
        return a.toString()
      })
  } catch (e) {
    logger.error('failed to guess page range', e)
    return []
  }
}

export async function schedule(id: string, ...pages: string[]) {
  logger.info(`schedule parse ${pages.join(', ')}`)

  const lambda = new Lambda({ region: 'eu-west-1' })
  const invoke = (data: any) =>
    lambda
      .invoke({
        FunctionName: 'parser-prod-parsePodcast',
        InvocationType: 'Event',
        Payload: JSON.stringify(data),
      })
      .promise()

  if (pages.length === 1) {
    await invoke({ id, page: pages[0], incremental: true })
  } else {
    await lock.createCountdown(id, pages.length)
    await Promise.all(
      pages.map(page => invoke({ id, page, incremental: false }))
    )
  }
}

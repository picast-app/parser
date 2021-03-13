import { Lambda } from 'aws-sdk'

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

export async function schedule(id: string, page: string) {
  logger.info(`schedule parse ${page}`)

  const lambda = new Lambda({ region: 'eu-west-1' })
  await lambda
    .invoke({
      FunctionName: 'parser-prod-parsePodcast',
      InvocationType: 'Event',
      Payload: JSON.stringify({ id, page }),
    })
    .promise()
}

import type { APIGatewayEvent } from 'aws-lambda'

export const wrap = (
  handler: (event: APIGatewayEvent) => Promise<any>
) => async (event: APIGatewayEvent) => {
  try {
    const body = await handler(event)
    return { statusCode: 200, body }
  } catch (e) {
    logger.error(e?.toString?.() ?? e)
    return { statusCode: 404 }
  }
}

export const ttl = (seconds: number) => Math.floor(Date.now() / 1000 + seconds)

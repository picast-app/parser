import type * as AWS from 'aws-lambda'

type HandlerType = AWS.APIGatewayEvent

type Handler<T extends HandlerType> = AWS.Handler<T>

export default function <T extends HandlerType = HandlerType>(
  handler: Handler<T>
): Handler<T> {
  return async (...[event, ...args]: Parameters<Handler<T>>) => {
    try {
      const res = await handler(event, ...args)
      if ('Records' in event) return
      return {
        statusCode: 200,
        body: JSON.stringify(res),
      }
    } catch (e) {
      let error = e
      console.error(e)
      if (!['number'].includes(typeof e))
        error = JSON.stringify({ message: e?.toString?.() ?? e })

      return {
        statusCode: 500,
        [typeof error === 'number' ? 'statusCode' : 'body']: error,
      }
    }
  }
}

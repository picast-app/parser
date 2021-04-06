import { Lambda } from 'aws-sdk'

const lambda = new Lambda()

export const invoke = async (raw: string) => {
  logger.info('invoke core')
  const { Payload } = await lambda
    .invoke({
      FunctionName: 'parser-prod-graph',
      Payload: JSON.stringify({ raw }),
    })
    .promise()
  if (!Payload) throw Error('no result')
  const { errors, data } = JSON.parse(Payload.toString())
  if (errors?.length || !data)
    logger.error('core invocation failed', { errors, data })
  return data?.podcast
}

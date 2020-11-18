import type * as AWS from 'aws-lambda'
import handler from './utils/handler'

const parse = async (event: AWS.APIGatewayEvent) => {
  return 'hello'
}

export const parser = handler(parse)

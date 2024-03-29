import AWS from 'aws-sdk'

AWS.config.update({ region: 'eu-west-1' })

export const ddb = new AWS.DynamoDB.DocumentClient(
  process.env.IS_OFFLINE
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
      }
    : undefined
)

export const sns = new AWS.SNS()

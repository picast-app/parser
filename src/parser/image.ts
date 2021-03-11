import { sns } from '~/utils/aws'

export default async function processPhotos(podcast: string, url: string) {
  if (process.env.IS_OFFLINE) return
  await sns
    .publish({
      Message: JSON.stringify({ podcast, url }),
      TopicArn: process.env.RESIZE_SNS,
    })
    .promise()
}

import axios from 'axios'
import { sns } from '~/utils/aws'

export async function resize(podcast: string, url: string) {
  if (process.env.IS_OFFLINE) return
  await sns
    .publish({
      Message: JSON.stringify({ podcast, url }),
      TopicArn: process.env.RESIZE_SNS,
    })
    .promise()
}

export async function fetch(id: string): Promise<string[]> {
  const { data } = await axios.post('https://api.picast.app', {
    query: `{
    podcast(id:"${id}") {
      title
      author
      artwork
      covers
    }
  }`,
  })

  const covers = data?.data?.podcast?.covers ?? []
  logger.info(`fetched ${covers.length} covers`)
  return covers
}

import axios from 'axios'

export default async function fetchCoverArt(id: string): Promise<string[]> {
  if (process.env.IS_OFFLINE !== 'true') return []

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

  return data?.data?.podcast?.covers ?? []
}

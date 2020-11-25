import axios from 'axios'
import crypto from 'crypto'

export const query = async (
  path: string,
  params: { [k: string]: string | number | boolean }
) => {
  const time = (Date.now() / 1000) | 0
  const headers = {
    'X-Auth-Key': process.env.PI_API_KEY,
    'X-Auth-Date': time.toString(),
    Authorization: crypto
      .createHash('sha1')
      .update(process.env.PI_API_KEY + process.env.PI_API_SECRET + time, 'utf8')
      .digest('hex'),
  }

  const { data } = await axios.get(
    'https://api.podcastindex.org/api/1.0/' + path,
    {
      params,
      headers,
    }
  )

  return data
}

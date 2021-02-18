import axios from 'axios'
import { JSDOM } from 'jsdom'
import fs from 'fs'
import { UserInputError } from 'apollo-server-lambda'
import crc32 from 'crc/crc32'

const cache = process.env.IS_OFFLINE

export const podcast = async (_, { feed }) => {
  const cachePath = `feed_cache/${encodeURIComponent(feed)}`

  let data: string
  if (!cache || !fs.existsSync(cachePath)) {
    const res = await axios.get(feed)
    data = res.data
    if (cache) fs.writeFileSync(cachePath, data)
  } else {
    data = fs.readFileSync(cachePath, 'utf-8')
  }

  const { document } = new JSDOM(data, { contentType: 'text/xml' }).window

  const channel = document.querySelector('channel')
  if (!channel)
    throw new UserInputError("feed doesn't contain a channel element")

  const episodes = Array.from(channel.querySelectorAll(':scope > item'))
  episodes.forEach(node => node.remove())

  return { channel, episodes, feed, crc: crc32(data).toString(16) }
}

import axios from 'axios'
import { JSDOM } from 'jsdom'

export const podcast = async (_, { feed }) => {
  const { data } = await axios.get(feed)
  const { document } = new JSDOM(data, { contentType: 'text/xml' }).window

  const channel = document.querySelector('channel')

  const episodes = Array.from(channel.querySelectorAll(':scope > item'))

  episodes.forEach(node => node.remove())

  return { channel, episodes }
}

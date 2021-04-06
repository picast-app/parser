import parse from '~/core/xml/parse'
import fetch from '~/utils/fetchFeed'

export const podcast = async (_, { feed, raw }) =>
  raw ? parse(raw) : await fetch(feed)

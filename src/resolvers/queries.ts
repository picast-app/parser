import fetchFeed from '~/utils/fetchFeed'

export const podcast = async (_, { feed }) => await fetchFeed(feed)

import init from '@picast-app/db'

export const { podcasts, episodes } = init(
  process.env.IS_OFFLINE
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
      }
    : undefined
)

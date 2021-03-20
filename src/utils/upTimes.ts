export type UpdateTime = Partial<{
  etag: string
  lastRequested: Date
  lastChecked: Date
  lastModified: Date
}>

export const filterTime = (
  times: UpdateTime
): { [K in keyof UpdateTime]: string } => {
  if (
    isNaN(times.lastChecked.getTime()) ||
    times.lastRequested.getTime() - times.lastChecked.getTime() < 30 * 60e3
  )
    times.lastChecked = times.lastRequested
  return Object.fromEntries(
    Object.entries(times)
      .map(([k, v]) => [
        k,
        k === 'etag'
          ? v
          : isNaN((v as Date).getTime())
          ? undefined
          : (v as Date).toUTCString(),
      ])
      .filter(([, v]) => v)
  )
}

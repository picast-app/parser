export type UpdateTime = Partial<
  {
    [K in 'lastRequested' | 'lastChecked' | 'lastModified']: Date
  }
>

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
      .map(([k, v]) => [k, isNaN(v.getTime()) ? undefined : v.toUTCString()])
      .filter(([, v]) => v)
  )
}

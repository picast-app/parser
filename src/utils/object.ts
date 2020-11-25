// eslint-disable-next-line @typescript-eslint/ban-types
type obj = object

export const map = <T extends obj>(
  o: T,
  func: <K extends keyof T>(k: K, v: typeof o[K]) => [string, any]
) => Object.fromEntries(Object.entries(o).map(([k, v]) => func(k as any, v)))

export const filter = <T extends obj>(
  o: T,
  func: <K extends keyof T>(k: K, v: typeof o[K]) => boolean
): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(([k, v]) => func(k as any, v))
  ) as Partial<T>

type Foo<T extends any[]> = T[number]

export const pickKeys = <T extends obj, K extends (keyof T)[]>(
  o: T,
  keys: K
): Pick<T, Foo<K>> => filter(o, k => keys.includes(k)) as any

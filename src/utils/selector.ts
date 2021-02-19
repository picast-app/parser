import { query } from '~/utils/dom'
import striptags from 'striptags'

export const buildSelector = <T = Element>(
  selector: (parent: T) => Element
) => (selects: TemplateStringsArray) => {
  let mod = (v: string): any => v
  const exec = (parent: T) =>
    mod(query(selector(parent), ...selects[0].split('\n')))
  return Object.defineProperties(exec, {
    time: {
      get() {
        mod = v => (new Date(v).getTime() / 1000) | 0
        return this
      },
    },
    strip: {
      get() {
        mod = v => striptags(v)
        return this
      },
    },
    duration: {
      get() {
        mod = v => {
          try {
            const [s = 0, m = 0, h = 0, d = 0] = v
              .split(':')
              .reverse()
              .map(v => parseInt(v))
            return Math.round(s + m * 60 + h * 60 ** 2 + d * 60 ** 2 * 24)
          } catch (e) {
            return 0
          }
        }
        return this
      },
    },
  })
}

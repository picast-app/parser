import crypto from 'crypto'

// convert number into base36 string, but replace vowels with
// uppercase consonants, to avoid potential swear words

const VOWEL_SHIFT = -31

export const numberToId = (n: number) => vowelShift(n.toString(36))

export const idToNumber = (v: string) => parseInt(vowelUnshift(v), 36)

export const vowelShift = (v: string) =>
  v.replace(/[aeiou]/g, c =>
    String.fromCharCode(c[0].charCodeAt(0) + VOWEL_SHIFT)
  )

export const vowelUnshift = (v: string) =>
  v.replace(/([A-Z])/g, c =>
    String.fromCharCode(c[0].charCodeAt(0) - VOWEL_SHIFT)
  )

export const guidSha1 = (id: string, length = 6) => {
  const shasum = crypto.createHash('sha1')
  shasum.update(id)
  return shasum.digest('hex').slice(0, length)
}

export const episodeSK = (id: string, published = 0) =>
  ('0'.repeat(5) + published.toString(36)).slice(-6) + id

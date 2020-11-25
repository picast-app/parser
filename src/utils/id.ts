import crypto from 'crypto'

// convert number into base36 string, but replace vowels with
// uppercase consonants, to avoid potential swear words

const VOWEL_SHIFT = -31

export const numberToId = (n: number) =>
  n
    .toString(36)
    .replace(/[aeiou]/g, c =>
      String.fromCharCode(c[0].charCodeAt(0) + VOWEL_SHIFT)
    )

export const idToNumber = (v: string) =>
  parseInt(
    v.replace(/([A-Z])/g, c =>
      String.fromCharCode(c[0].charCodeAt(0) - VOWEL_SHIFT)
    ),
    36
  )

export const episodeSK = (id: string, published = 0) => {
  const shasum = crypto.createHash('sha1')
  shasum.update(id)
  return `${('0'.repeat(5) + published.toString(36)).slice(-6)}#${shasum
    .digest('hex')
    .slice(0, 6)}`
}

const select = (el: Element, query: string) => {
  const [selector, field = 'text'] = `:scope${query}`
    .replace(/(?<=\w):(?=\w)/g, '\\:')
    .split('.')
  const node = el.querySelector(selector)
  if (field === 'text') return node?.textContent
  return node?.getAttribute(field)
}

export const query = (el: Element, ...queries: string[]) => {
  queries = queries.filter(Boolean)
  for (const line of queries) {
    const res = select(el, line.trim())
    if (res !== undefined) return res
  }
}

export const queryTag = (strs: TemplateStringsArray, el: Element) =>
  query(el, ...strs.slice(1).join('').split('\n'))

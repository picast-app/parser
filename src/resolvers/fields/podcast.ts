type Parent = {
  channel: Element
}

export const title = ({ channel }: Parent) =>
  channel.querySelector(':scope > title').textContent

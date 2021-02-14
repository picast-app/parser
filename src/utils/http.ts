export class Headers {
  private readonly headers: Record<string, string>

  constructor(raw: Record<string, string> = {}) {
    this.headers = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v])
    )
  }

  public get(name: string) {
    return this.headers[name.toLowerCase()]
  }
}

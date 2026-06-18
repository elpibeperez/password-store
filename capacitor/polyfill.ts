// Polyfill Buffer for Android WebView (Capacitor)
// Simple implementation that covers what isomorphic-git needs

class PolyBuffer {
  static from(data: any, encoding?: any): PolyBuffer {
    if (typeof data === 'string') {
      if (encoding === 'hex') {
        const bytes = new Uint8Array(data.length / 2)
        for (let i = 0; i < data.length; i += 2) {
          bytes[i / 2] = parseInt(data.slice(i, i + 2), 16)
        }
        return new PolyBuffer(bytes)
      }
      if (encoding === 'utf8' || !encoding) {
        const encoder = new TextEncoder()
        return new PolyBuffer(encoder.encode(data))
      }
    }
    if (data instanceof Uint8Array) return new PolyBuffer(data)
    if (Array.isArray(data)) return new PolyBuffer(new Uint8Array(data))
    return new PolyBuffer(new Uint8Array(0))
  }

  static alloc(size: number): PolyBuffer {
    return new PolyBuffer(new Uint8Array(size))
  }

  static concat(list: PolyBuffer[]): PolyBuffer {
    const total = list.reduce((s, b) => s + b._data.length, 0)
    const result = new Uint8Array(total)
    let pos = 0
    for (const buf of list) {
      result.set(buf._data, pos)
      pos += buf._data.length
    }
    return new PolyBuffer(result)
  }

  static isBuffer(obj: any): boolean {
    return obj instanceof PolyBuffer
  }

  private _data: Uint8Array

  constructor(data: Uint8Array) {
    this._data = data
  }

  get length(): number { return this._data.length }

  toString(encoding?: string): string {
    if (encoding === 'hex') {
      return Array.from(this._data).map(b => b.toString(16).padStart(2, '0')).join('')
    }
    const decoder = new TextDecoder()
    return decoder.decode(this._data)
  }

  slice(start?: number, end?: number): PolyBuffer {
    return new PolyBuffer(this._data.slice(start, end))
  }

  copy(target: PolyBuffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): number {
    const src = this._data.slice(sourceStart || 0, sourceEnd || this._data.length)
    target._data.set(src, targetStart || 0)
    return src.length
  }

  writeUInt32BE(value: number, offset: number): number {
    this._data[offset] = (value >> 24) & 0xff
    this._data[offset + 1] = (value >> 16) & 0xff
    this._data[offset + 2] = (value >> 8) & 0xff
    this._data[offset + 3] = value & 0xff
    return offset + 4
  }

  readUInt32BE(offset: number): number {
    return (this._data[offset] << 24) | (this._data[offset + 1] << 16) |
           (this._data[offset + 2] << 8) | this._data[offset + 3]
  }

  [Symbol.iterator]() {
    return this._data[Symbol.iterator]()
  }

  toJSON() { return { type: 'Buffer', data: Array.from(this._data) } }
}

;(globalThis as any).Buffer = PolyBuffer
;(globalThis as any).process = { env: {} } as any

console.log('password-store: Buffer polyfill loaded')

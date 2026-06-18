// HTTP adapter for isomorphic-git
// Android: uses NativeHttpBridge (Java, synchronous, no CORS)
// Fallback: XMLHttpRequest

function toHex(b: Uint8Array, n = 40): string {
  return Array.from(b.slice(0, n)).map(x => x.toString(16).padStart(2, '0')).join(' ')
}

function hasNativeBridge(): boolean {
  try {
    const b = (window as any).NativeHttpBridge
    return b !== undefined && b !== null
  } catch { return false }
}

async function request({
  url, method, headers, body, onProgress
}: {
  url: string; method: string; headers: Record<string, string>
  body?: AsyncIterableIterator<Uint8Array>
  onProgress?: any
}): Promise<any> {
  let bodyData: Uint8Array | undefined
  if (body) {
    const chunks: Uint8Array[] = []
    for await (const chunk of body) chunks.push(chunk)
    const t = chunks.reduce((s, c) => s + c.length, 0)
    bodyData = new Uint8Array(t); let p = 0
    for (const c of chunks) { bodyData.set(c, p); p += c.length }
  }

  if (hasNativeBridge()) {
    return await nativeRequest(url, method, headers, bodyData, onProgress)
  }

  return await xhrRequest(url, method, headers, bodyData, onProgress)
}

async function nativeRequest(
  url: string, method: string,
  headers: Record<string, string>,
  bodyData: Uint8Array | undefined,
  onProgress?: any
): Promise<any> {
  const bridge = (window as any).NativeHttpBridge

  // Build header array for Java
  const headerArr: { k: string; v: string }[] = []
  for (const [k, v] of Object.entries(headers || {})) {
    const lk = k.toLowerCase()
    if (['host', 'connection'].includes(lk)) continue
    if (v != null) headerArr.push({ k: lk, v: String(v) })
  }

  const bodyB64 = bodyData ? btoa(String.fromCharCode(...bodyData)).replace(/\\n/g, '') : ''

  const resultJson = bridge.request(method, url, JSON.stringify(headerArr), bodyB64)
  const result = JSON.parse(resultJson)

  if (result.status === 0 && result.statusMessage) {
    throw new Error(result.statusMessage)
  }

  // Decode base64 body
  let raw: string
  try {
    raw = atob(result.body.replace(/\s/g, ''))
  } catch {
    raw = result.body
  }
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)

  const respHeaders: Record<string, string> = result.headers || {}

  console.log('HTTP:', method, url, '->', result.status, bytes.length + 'b', typeof result.body)

  return {
    url: result.url || url, method,
    statusCode: result.status,
    statusMessage: result.statusMessage || String(result.status),
    body: iterBody(bytes),
    headers: respHeaders
  }
}

async function xhrRequest(
  url: string, method: string,
  headers: Record<string, string>,
  bodyData: Uint8Array | undefined,
  onProgress?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url, true)
    xhr.responseType = 'arraybuffer'

    for (const [key, value] of Object.entries(headers || {})) {
      if (key.toLowerCase() === 'user-agent') continue
      try { xhr.setRequestHeader(key, String(value)) } catch {}
    }

    xhr.onload = () => {
      if (xhr.status >= 400) { reject(new Error(`HTTP ${xhr.status}`)); return }
      const hdrs: Record<string, string> = {}
      const raw = xhr.getAllResponseHeaders()
      for (const line of raw.split('\n')) {
        const i = line.indexOf(':')
        if (i > 0) hdrs[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
      }
      resolve({
        url: xhr.responseURL || url, method,
        statusCode: xhr.status, statusMessage: xhr.statusText,
        body: iterBody(new Uint8Array(xhr.response)),
        headers: hdrs
      })
    }
    xhr.onerror = () => reject(new Error(`Network error: ${url}`))
    xhr.ontimeout = () => reject(new Error(`Timeout: ${url}`))
    xhr.timeout = 120000
    xhr.send(bodyData || undefined)
  })
}

// Async iterator for isomorphic-git
function iterBody(data: Uint8Array) {
  let index = 0;
  return {
    next() {
      if (index >= data.length) return Promise.resolve({ done: true, value: undefined });
      const chunk = data.slice(index, index + 65536);
      index += chunk.length;
      return Promise.resolve({ done: false, value: chunk });
    },
    return() { return Promise.resolve({ done: true }); },
    [Symbol.asyncIterator]() { return this; }
  };
}

export default { request }

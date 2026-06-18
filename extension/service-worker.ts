/// <reference lib="webworker" />

// Polyfill Node.js globals for Chrome Extension service worker
;(globalThis as any).process = { env: {} } as any
;(globalThis as any).Buffer = (globalThis as any).Buffer || class {
  static from(data: any, encoding?: any) {
    if (typeof data === 'string') {
      if (encoding === 'hex') {
        const bytes = new Uint8Array(data.length / 2)
        for (let i = 0; i < data.length; i += 2) bytes[i / 2] = parseInt(data.slice(i, i + 2), 16)
        return new this(bytes)
      }
      return new this(new TextEncoder().encode(data))
    }
    if (data instanceof Uint8Array) return new this(data)
    if (Array.isArray(data)) return new this(new Uint8Array(data))
    return new this(new Uint8Array(0))
  }
  static alloc(size: number) { return new this(new Uint8Array(size)) }
  static concat(list: any[]) {
    const total = list.reduce((s: number, b: any) => s + b.length, 0)
    const r = new Uint8Array(total); let p = 0
    for (const b of list) { r.set(b._data || b, p); p += b.length }
    return new this(r)
  }
  static isBuffer(obj: any) { return obj instanceof this }
  constructor(data: Uint8Array) { this._data = data }
  get length() { return this._data.length }
  toString(encoding?: string) {
    if (encoding === 'hex') return Array.from(this._data).map((b: number) => b.toString(16).padStart(2, '0')).join('')
    return new TextDecoder().decode(this._data)
  }
  slice(s?: number, e?: number) { return new (this.constructor as any)(this._data.slice(s, e)) }
  writeUInt32BE(v: number, o: number) { this._data[o] = (v >> 24) & 0xff; this._data[o+1] = (v >> 16) & 0xff; this._data[o+2] = (v >> 8) & 0xff; this._data[o+3] = v & 0xff; return o + 4 }
  readUInt32BE(o: number) { return (this._data[o] << 24) | (this._data[o+1] << 16) | (this._data[o+2] << 8) | this._data[o+3] }
  includes(search: any, start?: number) {
    if (typeof search === 'string') search = new TextEncoder().encode(search)
    if (search instanceof Uint8Array || (search as any)._data) {
      const d = this._data, n = (search as any)._data || search, end = d.length - n.length
      for (let i = start || 0; i <= end; i++) { let f = true; for (let j = 0; j < n.length; j++) { if (d[i+j] !== n[j]) { f = false; break } } if (f) return true }
      return false
    }
    return false
  }
  indexOf(value: any, byteOffset?: number) {
    if (typeof value === 'number') { for (let i = byteOffset || 0; i < this._data.length; i++) { if (this._data[i] === value) return i } return -1 }
    return this.includes(value, byteOffset) ? (byteOffset || 0) : -1
  }
}

import * as store from './lib/store'
import * as git from './lib/git'
import type { ListEntry, EntryMeta } from './lib/types'

// ── Session persistence ──────────────────────────────────────

async function tryRestoreSession(): Promise<boolean> {
  try {
    const data = await chrome.storage.session.get(['passphrase', 'keyArmored'])
    if (data.passphrase && data.keyArmored) {
      await store.importKey(data.keyArmored)
      const ok = await store.unlockKey(data.passphrase)
      return ok
    }
  } catch {}
  return false
}

async function saveSession(passphrase: string) {
  try {
    const armored = await store.getKeyFileContent()
    if (armored) {
      await chrome.storage.session.set({ passphrase, keyArmored: armored })
    }
  } catch {}
}

async function clearSession() {
  await chrome.storage.session.remove(['passphrase', 'keyArmored'])
  store.resetKey()
}

// Restore session on startup (if any)
let sessionRestored = false
tryRestoreSession().then((ok) => { sessionRestored = ok })

// ── Message handler ──────────────────────────────────────────

async function handle(msg: any): Promise<any> {
  switch (msg.cmd) {
    // Key management
    case 'key:isSetup':
      return { ok: true, data: await store.isKeySetup() }

    case 'key:isUnlocked':
      return { ok: true, data: store.getUnlockedPrivateKey() !== null }

    case 'key:generate':
      await store.generateKey(msg.name, msg.email, msg.passphrase)
      await saveSession(msg.passphrase)
      return { ok: true }

    case 'key:import':
      await store.importKey(msg.armored)
      return { ok: true }

    case 'key:unlock': {
      const ok = await store.unlockKey(msg.passphrase)
      if (ok) await saveSession(msg.passphrase)
      return { ok, data: ok }
    }

    case 'key:reset':
      await clearSession()
      return { ok: true }

    case 'key:getKeyInfo': {
      const info = await store.getKeyInfo()
      return { ok: true, data: info }
    }

    // Store operations
    case 'store:list':
      return { ok: true, data: await store.listEntries(msg.dir) }

    case 'store:read':
      return { ok: true, data: await store.readGpg(msg.path) }

    case 'store:write':
      await store.writeGpg(msg.path, msg.content)
      return { ok: true }

    case 'store:remove':
      await store.remove(msg.path)
      return { ok: true }

    case 'store:mkdir':
      await store.mkdir(msg.dirPath)
      return { ok: true }

    case 'store:rmdir':
      await store.rmdir(msg.dirPath)
      return { ok: true }

    case 'store:readMeta':
      return { ok: true, data: await store.readMeta(msg.path) }

    case 'store:writeMeta':
      await store.writeMeta(msg.path, msg.data)
      return { ok: true }

    // Git operations
    case 'git:clone':
      if (msg.token) {
        git.setToken(msg.token)
        chrome.storage.sync.set({ gitToken: msg.token })
      }
      await git.cloneRepo(msg.url, msg.token || '')
      return { ok: true, data: { cloned: true } }

    case 'git:status':
      return { ok: true, data: await git.getStatus() }

    case 'git:commit':
      await git.addAll()
      await git.commit(msg.message)
      await git.push()
      return { ok: true }

    case 'git:pull':
      await git.pull()
      return { ok: true }

    case 'git:push':
      await git.push()
      return { ok: true }

    case 'git:getRemote':
      return { ok: true, data: await git.getRemote() }

    case 'git:branch':
      return { ok: true, data: await git.currentBranch() }

    case 'git:hasRemote':
      return { ok: true, data: await git.hasRemote() }

    case 'git:setToken':
      git.setToken(msg.token)
      chrome.storage.sync.set({ gitToken: msg.token })
      return { ok: true }

    default:
      return { ok: false, error: `Unknown command: ${msg.cmd}` }
  }
}

// Load token from storage on startup
chrome.storage.sync.get('gitToken').then((result) => {
  if (result.gitToken) git.setToken(result.gitToken)
})

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  handle(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err) }))
  return true
})

import * as pgp from '../extension/lib/crypto'
import type { ListEntry, EntryMeta, GitStatus, KeyInfo } from '../extension/lib/types'

// Native bridges injected by Java
declare const FileBridge: any
declare const GitBridge: any

function isAndroid(): boolean {
  return typeof FileBridge !== 'undefined' && FileBridge !== null
}

// ── Store operations (via FileBridge) ─────────────────────────────

function base64Encode(data: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i])
  return btoa(bin)
}

function base64Decode(b64: string): Uint8Array {
  const raw = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function storeRead(path: string): Promise<string> {
  const b64 = FileBridge.readFile(path)
  if (!b64) throw new Error('File not found: ' + path)
  return new TextDecoder().decode(base64Decode(b64))
}

async function storeWrite(path: string, text: string) {
  const data = new TextEncoder().encode(text)
  FileBridge.writeFile(path, base64Encode(data))
}

// ── Key management (via openpgp.js + FileBridge) ──────────────────

let unlockedPrivateKey: pgp.PrivateKey | null = null
let unlockedPublicKey: pgp.PublicKey | null = null

async function readKeyFile(): Promise<string | null> {
  const b64 = FileBridge.readFile('.gpg-key.asc')
  if (!b64) return null
  return new TextDecoder().decode(base64Decode(b64))
}

async function writeKeyFile(content: string) {
  FileBridge.writeFile('.gpg-key.asc', base64Encode(new TextEncoder().encode(content)))
  FileBridge.writeFile('.gpg-id', base64Encode(new TextEncoder().encode('placeholder')))
}

// ── Exported API ──────────────────────────────────────────────────

export function isAvailable(): boolean {
  return isAndroid()
}

export const nativeApi = {
  store: {
    list: async (dir?: string): Promise<ListEntry[]> => {
      const json = FileBridge.listFiles(dir || '')
      const parsed: ListEntry[] = JSON.parse(json)
      console.log('FileBridge.listFiles("' + (dir || '') + '") →', parsed.length, 'entries:', json.slice(0, 200))
      return parsed
    },
    read: async (path: string): Promise<string> => {
      const encrypted = await storeRead('/' + path)
      if (!unlockedPrivateKey) throw new Error('Key not unlocked')
      return await pgp.decryptText(encrypted, unlockedPrivateKey)
    },
    write: async (path: string, content: string) => {
      if (!unlockedPublicKey) throw new Error('Key not unlocked')
      const encrypted = await pgp.encryptText(content, [unlockedPublicKey])
      await storeWrite('/' + path, encrypted)
    },
    readMeta: async (path: string): Promise<EntryMeta | null> => {
      const metaPath = path.replace(/\.gpg$/, '') + '.meta.json'
      const text = FileBridge.readFileText(metaPath)
      if (!text) return null
      try { return JSON.parse(text) } catch { return null }
    },
    writeMeta: async (path: string, data: EntryMeta) => {
      const metaPath = path.replace(/\.gpg$/, '') + '.meta.json'
      FileBridge.writeFileText(metaPath, JSON.stringify(data, null, 2))
    },
    remove: async (path: string) => { FileBridge.delete('/' + path) },
    mkdir: async (dirPath: string) => { FileBridge.mkdir('/' + dirPath) },
    rmdir: async (dirPath: string) => { FileBridge.delete('/' + dirPath) }
  },

  key: {
    isSetup: async (): Promise<boolean> => {
      return FileBridge.exists('.gpg-key.asc')
    },
    isUnlocked: (): boolean => {
      return unlockedPrivateKey !== null
    },
    generate: async (name: string, email: string, passphrase: string): Promise<string> => {
      const key = await pgp.generateKey(name, email, passphrase)
      const privKey = await pgp.readPrivateKey(key.privateKey)
      const decrypted = await pgp.decryptKey(privKey, passphrase)
      unlockedPrivateKey = decrypted
      unlockedPublicKey = pgp.getPublicKey(decrypted)
      await writeKeyFile(key.privateKey)
      return key.privateKey
    },
    importKey: async (armored: string): Promise<string> => {
      const privKey = await pgp.readPrivateKey(armored)
      await writeKeyFile(armored)
      return pgp.getFingerprint(privKey)
    },
    unlock: async (passphrase: string): Promise<boolean> => {
      try {
        const armored = await readKeyFile()
        if (!armored) return false
        const privKey = await pgp.readPrivateKey(armored)
        const decrypted = await pgp.decryptKey(privKey, passphrase)
        if (!decrypted.isDecrypted()) return false
        await pgp.encryptText('ping', [pgp.getPublicKey(decrypted)])
        unlockedPrivateKey = decrypted
        unlockedPublicKey = pgp.getPublicKey(decrypted)
        return true
      } catch { return false }
    },
    reset: async () => {
      unlockedPrivateKey = null
      unlockedPublicKey = null
      FileBridge.delete('.gpg-key.asc')
      FileBridge.delete('.gpg-id')
    },
    getKeyInfo: async (): Promise<KeyInfo | null> => {
      if (!unlockedPrivateKey) return null
      return {
        id: unlockedPrivateKey.getKeyID().toHex(),
        fingerprint: pgp.getFingerprint(unlockedPrivateKey),
        userIds: pgp.getUserIds(unlockedPrivateKey)
      }
    }
  },

  git: {
    clone: async (url: string, token: string) => {
      const json = GitBridge.clone(url, token)
      console.log('GitBridge.clone →', json)
      const result = JSON.parse(json)
      if (!result.ok) throw new Error(result.error || 'Clone failed')
    },
    status: async (): Promise<GitStatus> => {
      return JSON.parse(GitBridge.status())
    },
    commit: async (message: string) => {
      let r = JSON.parse(GitBridge.addAll())
      if (!r.ok) throw new Error(r.error)
      r = JSON.parse(GitBridge.commit(message))
      if (!r.ok) throw new Error(r.error)
      r = JSON.parse(GitBridge.push(''))
      if (!r.ok) {
        // Push might fail if no remote or no changes, which is OK for commit-only
        console.log('Push after commit:', r.error)
      }
    },
    pull: async () => {
      const r = JSON.parse(GitBridge.pull(''))
      if (!r.ok) throw new Error(r.error)
    },
    push: async () => {
      const r = JSON.parse(GitBridge.push(''))
      if (!r.ok) throw new Error(r.error)
    },
    getRemote: async (): Promise<string | null> => {
      return GitBridge.getRemote() || null
    },
    branch: async (): Promise<string | null> => {
      return GitBridge.getBranch() || null
    },
    hasRemote: async (): Promise<boolean> => {
      return GitBridge.hasRepo()
    }
  }
}

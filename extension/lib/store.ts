import FS from '@isomorphic-git/lightning-fs'
import * as pgp from './crypto'
import type { ListEntry, EntryMeta } from './types'

const fs = new FS('pass-store')
const dir = '/'

let unlockedPrivateKey: pgp.PrivateKey | null = null
let unlockedPublicKey: pgp.PublicKey | null = null

export function getUnlockedPublicKey() { return unlockedPublicKey }

function absPath(filepath: string) {
  return filepath.startsWith('/') ? filepath : dir + filepath
}

async function readText(filepath: string): Promise<string> {
  const buf = await fs.promises.readFile(absPath(filepath))
  return new TextDecoder().decode(buf)
}

async function writeText(filepath: string, text: string) {
  await fs.promises.writeFile(absPath(filepath), text, 'utf8')
}

async function exists(filepath: string): Promise<boolean> {
  try {
    await fs.promises.stat(absPath(filepath))
    return true
  } catch { return false }
}

async function mkdirRecursive(dirpath: string) {
  const parts = (dirpath.startsWith('/') ? dirpath.slice(1) : dirpath).split('/')
  let acc = ''
  for (const p of parts) {
    if (!p) continue
    acc = acc ? `${acc}/${p}` : `/${p}`
    try { await fs.promises.mkdir(acc) } catch {}
  }
}

export async function listEntries(basePath = ''): Promise<ListEntry[]> {
  const entries: ListEntry[] = []
  function joinPath(parent: string, child: string) {
    const sep = parent === '/' ? '' : '/'
    return parent + sep + child
  }

  async function walk(dirPath: string): Promise<void> {
    let items: string[] = []
    try { items = await fs.promises.readdir(dirPath) } catch { return }

    for (const name of items) {
      if (name.startsWith('.')) continue
      if (name.endsWith('.meta.json')) continue
      const fullPath = joinPath(dirPath, name)
      let stat
      try { stat = await fs.promises.stat(fullPath) } catch { continue }

      const relPath = fullPath.replace(/^\//, '')
      if (stat.isDirectory()) {
        entries.push({ name, path: relPath, isDir: true })
        await walk(fullPath)
      } else if (name.endsWith('.gpg')) {
        entries.push({ name: name.slice(0, -4), path: relPath, isDir: false })
      }
    }
  }

  const targetDir = basePath ? joinPath(dir, basePath) : dir
  await walk(targetDir)
  return entries
}

function metaPath(gpgPath: string) {
  return gpgPath.replace(/\.gpg$/, '') + '.meta.json'
}

export async function readGpg(filepath: string): Promise<string> {
  const armored = await readText('/' + filepath)
  if (!unlockedPrivateKey) throw new Error('Key not unlocked')
  return await pgp.decryptText(armored, unlockedPrivateKey)
}

export async function writeGpg(filepath: string, content: string) {
  if (!unlockedPublicKey) throw new Error('Key not unlocked')
  const encrypted = await pgp.encryptText(content, [unlockedPublicKey])
  await mkdirRecursive('/' + filepath.replace(/\/[^/]+$/, ''))
  await writeText('/' + filepath, encrypted)
}

export async function readMeta(filepath: string): Promise<EntryMeta | null> {
  try {
    const data = await readText('/' + metaPath(filepath))
    return JSON.parse(data)
  } catch { return null }
}

export async function writeMeta(filepath: string, data: EntryMeta) {
  await mkdirRecursive('/' + filepath.replace(/\/[^/]+$/, ''))
  await writeText('/' + metaPath(filepath), JSON.stringify(data, null, 2))
}

export async function remove(filepath: string) {
  const fp = absPath(filepath)
  await fs.promises.unlink(fp)
  try { await fs.promises.unlink(absPath(metaPath(filepath))) } catch {}
}

export async function mkdir(dirpath: string) {
  await mkdirRecursive(absPath(dirpath))
}

export async function rmdir(dirpath: string) {
  await fs.promises.rmdir(absPath(dirpath))
}

// Key management

export async function isKeySetup() {
  return await exists('/.gpg-key.asc')
}

export async function generateKey(name: string, email: string, passphrase: string) {
  const key = await pgp.generateKey(name, email, passphrase)
  const privKey = await pgp.readPrivateKey(key.privateKey)
  const fingerprint = pgp.getFingerprint(privKey)

  await writeText('/.gpg-key.asc', key.privateKey)
  await writeText('/.gpg-id', fingerprint)

  const decrypted = await pgp.decryptKey(privKey, passphrase)
  unlockedPrivateKey = decrypted
  unlockedPublicKey = pgp.getPublicKey(decrypted)
  return key.privateKey
}

export async function importKey(armored: string) {
  const privKey = await pgp.readPrivateKey(armored)
  const fingerprint = pgp.getFingerprint(privKey)

  await writeText('/.gpg-key.asc', armored)
  await writeText('/.gpg-id', fingerprint)
  return fingerprint
}

export async function unlockKey(passphrase: string): Promise<boolean> {
  try {
    const data = await readText('/.gpg-key.asc')
    const privKey = await pgp.readPrivateKey(data)
    const decrypted = await pgp.decryptKey(privKey, passphrase)
    if (!decrypted.isDecrypted()) return false

    const pubKey = pgp.getPublicKey(decrypted)
    await pgp.encryptText('ping', [pubKey])

    unlockedPrivateKey = decrypted
    unlockedPublicKey = pubKey
    return true
  } catch {
    return false
  }
}

export function getUnlockedPrivateKey() {
  return unlockedPrivateKey
}

export async function getKeyFileContent(): Promise<string | null> {
  try {
    return await readText('/.gpg-key.asc')
  } catch { return null }
}

export async function getKeyInfo() {
  if (!unlockedPrivateKey) return null
  return {
    id: unlockedPrivateKey.getKeyID().toHex(),
    fingerprint: pgp.getFingerprint(unlockedPrivateKey),
    userIds: pgp.getUserIds(unlockedPrivateKey)
  }
}

export async function resetKey() {
  unlockedPrivateKey = null
  unlockedPublicKey = null
  try { await fs.promises.unlink(absPath('/.gpg-key.asc')) } catch {}
  try { await fs.promises.unlink(absPath('/.gpg-id')) } catch {}
}

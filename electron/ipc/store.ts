import { ipcMain, app } from 'electron'
import { readdir, readFile, writeFile, unlink, mkdir, rm } from 'fs/promises'
import { join, relative, dirname } from 'path'
import * as pgp from '../crypto/openpgp'
import { getUnlockedPrivateKey, getUnlockedPublicKey } from './key'

function passDir() {
  return join(app.getPath('home'), '.password-store')
}

function metaPath(gpgPath: string) {
  return gpgPath.replace(/\.gpg$/, '').replace(/\\/g, '/') + '.meta.json'
}

interface ListEntry {
  name: string
  path: string
  isDir: boolean
}

async function listRecursive(dir: string, baseDir: string): Promise<ListEntry[]> {
  const entries: ListEntry[] = []
  try {
    const items = await readdir(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.')) continue
      if (item.name.endsWith('.meta.json')) continue
      const fullPath = join(dir, item.name)
      const relPath = relative(baseDir, fullPath).replace(/\\/g, '/')
      if (item.isDirectory()) {
        entries.push({ name: item.name, path: relPath, isDir: true })
        entries.push(...(await listRecursive(fullPath, baseDir)))
      } else if (item.name.endsWith('.gpg') && !item.name.startsWith('.')) {
        const name = item.name.slice(0, -4)
        entries.push({ name, path: relPath, isDir: false })
      }
    }
  } catch {}
  return entries
}

export function registerStoreHandlers() {
  ipcMain.handle('store:list', async (_event, dir?: string) => {
    const root = passDir()
    const targetDir = dir ? join(root, dir) : root
    return await listRecursive(targetDir, root)
  })

  ipcMain.handle('store:read', async (_event, path: string) => {
    const root = passDir()
    const fullPath = join(root, path)
    const armored = await readFile(fullPath, 'utf-8')

    const privKey = getUnlockedPrivateKey()
    if (!privKey) throw new Error('Key not unlocked')

    return await pgp.decryptText(armored, privKey)
  })

  ipcMain.handle('store:write', async (_event, path: string, content: string) => {
    const root = passDir()
    const fullPath = join(root, path)

    const pubKey = getUnlockedPublicKey()
    if (!pubKey) throw new Error('Key not unlocked')

    const encrypted = await pgp.encryptText(content, [pubKey])
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, encrypted, 'utf-8')
  })

  ipcMain.handle('store:remove', async (_event, path: string) => {
    const root = passDir()
    const fullPath = join(root, path)
    await unlink(fullPath)

    const metaFull = join(root, metaPath(path))
    await rm(metaFull, { force: true })
  })

  ipcMain.handle('store:mkdir', async (_event, dirPath: string) => {
    const root = passDir()
    const fullPath = join(root, dirPath)
    await mkdir(fullPath, { recursive: true })
  })

  ipcMain.handle('store:rmdir', async (_event, dirPath: string) => {
    const root = passDir()
    const fullPath = join(root, dirPath)
    await rm(fullPath, { recursive: true, force: true })
  })

  ipcMain.handle('store:readMeta', async (_event, path: string) => {
    const root = passDir()
    const fullPath = join(root, metaPath(path))
    try {
      const data = await readFile(fullPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  })

  ipcMain.handle('store:writeMeta', async (_event, path: string, data: object) => {
    const root = passDir()
    const fullPath = join(root, metaPath(path))
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8')
  })
}

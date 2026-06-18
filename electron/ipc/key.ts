import { ipcMain, app } from 'electron'
import { readFile, writeFile, access, mkdir, rm } from 'fs/promises'
import { execFile } from 'child_process'
import { join } from 'path'
import * as pgp from '../crypto/openpgp'

function passDir() {
  return join(app.getPath('home'), '.password-store')
}

function keyFile() {
  return join(passDir(), '.gpg-key.asc')
}

function gpgIdFile() {
  return join(passDir(), '.gpg-id')
}

let unlockedPrivateKey: pgp.PrivateKey | null = null
let unlockedPublicKey: pgp.PublicKey | null = null

export function getUnlockedPrivateKey(): pgp.PrivateKey | null {
  return unlockedPrivateKey
}

export function getUnlockedPublicKey(): pgp.PublicKey | null {
  return unlockedPublicKey
}

export function registerKeyHandlers() {
  ipcMain.handle('key:isSetup', async () => {
    try {
      await access(keyFile())
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('key:generate', async (_event, name: string, email: string, passphrase: string) => {
    const key = await pgp.generateKey(name, email, passphrase)

    const privKey = await pgp.readPrivateKey(key.privateKey)
    const fingerprint = pgp.getFingerprint(privKey)

    await mkdir(passDir(), { recursive: true })
    await writeFile(keyFile(), key.privateKey, 'utf-8')
    await writeFile(gpgIdFile(), fingerprint, 'utf-8')

    const decrypted = await pgp.decryptKey(privKey, passphrase)
    const pubKey = pgp.getPublicKey(decrypted)
    await pgp.encryptText('ping', [pubKey])

    unlockedPrivateKey = decrypted
    unlockedPublicKey = pubKey

    return key.privateKey
  })

  ipcMain.handle('key:import', async (_event, armored: string) => {
    const privKey = await pgp.readPrivateKey(armored)
    const fingerprint = pgp.getFingerprint(privKey)

    await mkdir(passDir(), { recursive: true })
    await writeFile(keyFile(), armored, 'utf-8')
    await writeFile(gpgIdFile(), fingerprint, 'utf-8')

    return fingerprint
  })

  ipcMain.handle('key:reset', async () => {
    unlockedPrivateKey = null
    unlockedPublicKey = null
    try { await rm(keyFile(), { force: true }) } catch {}
    try { await rm(gpgIdFile(), { force: true }) } catch {}
  })

  ipcMain.handle('key:unlock', async (_event, passphrase: string) => {
    try {
      const data = await readFile(keyFile(), 'utf-8')
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
  })

  ipcMain.handle('key:exportToGnuPG', async () => {
    if (!unlockedPrivateKey) return false
    try {
      const armored = unlockedPrivateKey.armor()
      await new Promise<void>((resolve, reject) => {
        const proc = execFile('gpg', ['--import'], { input: armored }, (err) => {
          err ? reject(err) : resolve()
        })
      })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('key:getKeyInfo', async () => {
    if (!unlockedPrivateKey) return null
    return {
      id: unlockedPrivateKey.getKeyID().toHex(),
      fingerprint: pgp.getFingerprint(unlockedPrivateKey),
      userIds: pgp.getUserIds(unlockedPrivateKey)
    }
  })
}

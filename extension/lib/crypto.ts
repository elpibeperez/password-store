import * as openpgp from 'openpgp'
import type { PrivateKey, PublicKey } from 'openpgp'

export type { PrivateKey, PublicKey }

export async function generateKey(name: string, email: string, passphrase: string) {
  return await openpgp.generateKey({
    userIDs: [{ name, email }],
    type: 'rsa',
    rsaBits: 4096,
    passphrase
  })
}

export async function readPrivateKey(armored: string) {
  return await openpgp.readPrivateKey({ armoredKey: armored })
}

export async function decryptKey(privateKey: PrivateKey, passphrase: string) {
  return await openpgp.decryptKey({ privateKey, passphrase })
}

export async function encryptText(text: string, publicKeys: PublicKey[]) {
  const message = await openpgp.createMessage({ text })
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKeys
  })
  return encrypted as string
}

export async function decryptText(armored: string, privateKey: PrivateKey) {
  const message = await openpgp.readMessage({ armoredMessage: armored })
  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: [privateKey]
  })
  return data as string
}

export function getPublicKey(privateKey: PrivateKey) {
  return privateKey.toPublic()
}

export function getFingerprint(key: PrivateKey | PublicKey) {
  return key.getFingerprint()
}

export function getUserIds(key: PrivateKey | PublicKey) {
  return key.getUserIDs().map((uid: string) => {
    const match = uid.match(/^(.*?)\s*<(.*?)>$/)
    if (match) {
      return { name: match[1].trim(), email: match[2] }
    }
    return { name: uid, email: '' }
  })
}

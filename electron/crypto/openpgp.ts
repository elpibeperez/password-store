import * as openpgp from 'openpgp'

export type { PrivateKey, PublicKey } from 'openpgp'

export async function generateKey(name: string, email: string, passphrase: string) {
  const key = await openpgp.generateKey({
    userIDs: [{ name, email }],
    type: 'rsa',
    rsaBits: 4096,
    passphrase
  })
  return key
}

export async function readPrivateKey(armored: string) {
  return await openpgp.readPrivateKey({ armoredKey: armored })
}

export async function decryptKey(privateKey: openpgp.PrivateKey, passphrase: string) {
  return await openpgp.decryptKey({ privateKey, passphrase })
}

export async function encryptKey(privateKey: openpgp.PrivateKey, passphrase: string) {
  return await openpgp.encryptKey({ privateKey, passphrase })
}

export async function encryptText(text: string, publicKeys: openpgp.PublicKey[]) {
  const message = await openpgp.createMessage({ text })
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKeys
  })
  return encrypted as string
}

export async function decryptText(armored: string, privateKey: openpgp.PrivateKey) {
  const message = await openpgp.readMessage({ armoredMessage: armored })
  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: [privateKey]
  })
  return data as string
}

export function getPublicKey(privateKey: openpgp.PrivateKey) {
  return privateKey.toPublic()
}

export function getFingerprint(key: openpgp.PrivateKey | openpgp.PublicKey) {
  return key.getFingerprint()
}

export function getUserIds(key: openpgp.PrivateKey | openpgp.PublicKey) {
  return key.getUserIDs().map((uid: string) => {
    const match = uid.match(/^(.*?)\s*<(.*?)>$/)
    if (match) {
      return { name: match[1].trim(), email: match[2] }
    }
    return { name: uid, email: '' }
  })
}

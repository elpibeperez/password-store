import * as store from '../../extension/lib/store'
import * as git from '../../extension/lib/git'
import type { ListEntry, EntryMeta, GitStatus, KeyInfo } from '../../extension/lib/types'

export const api = {
  store: {
    list: (dir?: string) => store.listEntries(dir),
    read: (path: string) => store.readGpg(path),
    write: (path: string, content: string) => store.writeGpg(path, content),
    remove: (path: string) => store.remove(path),
    mkdir: (dirPath: string) => store.mkdir(dirPath),
    rmdir: (dirPath: string) => store.rmdir(dirPath),
    readMeta: (path: string) => store.readMeta(path),
    writeMeta: (path: string, data: EntryMeta) => store.writeMeta(path, data)
  },
  key: {
    generate: (name: string, email: string, passphrase: string) => store.generateKey(name, email, passphrase),
    importKey: (armored: string) => store.importKey(armored),
    unlock: (passphrase: string) => store.unlockKey(passphrase),
    isSetup: () => store.isKeySetup(),
    isUnlocked: () => store.getUnlockedPrivateKey() !== null,
    getKeyInfo: () => store.getKeyInfo(),
    reset: () => store.resetKey()
  },
  git: {
    clone: (url: string, token: string) => { git.setToken(token); return git.cloneRepo(url, token) },
    status: () => git.getStatus(),
    pull: () => git.pull(),
    push: () => git.push(),
    commit: (message: string) => git.commitAll(message),
    getRemote: () => git.getRemote(),
    branch: () => git.currentBranch(),
    hasRemote: () => git.hasRemote(),
    setToken: (token: string) => git.setToken(token)
  }
}

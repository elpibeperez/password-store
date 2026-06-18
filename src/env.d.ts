/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

import type { ListEntry, KeyInfo, GitStatus, EntryMeta } from './types'

interface ElectronAPI {
  store: {
    list: (dir: string) => Promise<ListEntry[]>
    read: (path: string) => Promise<string>
    write: (path: string, content: string) => Promise<void>
    remove: (path: string) => Promise<void>
    mkdir: (dirPath: string) => Promise<void>
    rmdir: (dirPath: string) => Promise<void>
    readMeta: (path: string) => Promise<EntryMeta | null>
    writeMeta: (path: string, data: EntryMeta) => Promise<void>
  }
  key: {
    generate: (name: string, email: string, passphrase: string) => Promise<string>
    importKey: (armored: string) => Promise<string>
    unlock: (passphrase: string) => Promise<boolean>
    isSetup: () => Promise<boolean>
    getKeyInfo: () => Promise<KeyInfo | null>
    reset: () => Promise<void>
    exportToGnuPG: () => Promise<boolean>
  }
  git: {
    init: (dir: string) => Promise<void>
    clone: (url: string) => Promise<{ success: boolean; error?: string }>
    status: () => Promise<GitStatus>
    pull: () => Promise<{ success: boolean; error?: string }>
    push: () => Promise<{ success: boolean; error?: string }>
    commit: (message: string) => Promise<{ success: boolean; error?: string }>
    getRemote: () => Promise<string | null>
    setRemote: (url: string) => Promise<{ success: boolean; error?: string }>
    hasRepo: () => Promise<boolean>
    branch: () => Promise<string | null>
  }
}

interface Window {
  api: ElectronAPI
}

import { contextBridge, ipcRenderer } from 'electron'

const api = {
  store: {
    list: (dir: string) => ipcRenderer.invoke('store:list', dir),
    read: (path: string) => ipcRenderer.invoke('store:read', path),
    write: (path: string, content: string) => ipcRenderer.invoke('store:write', path, content),
    remove: (path: string) => ipcRenderer.invoke('store:remove', path),
    mkdir: (dirPath: string) => ipcRenderer.invoke('store:mkdir', dirPath),
    rmdir: (dirPath: string) => ipcRenderer.invoke('store:rmdir', dirPath),
    readMeta: (path: string) => ipcRenderer.invoke('store:readMeta', path),
    writeMeta: (path: string, data: object) => ipcRenderer.invoke('store:writeMeta', path, data)
  },
  key: {
    generate: (name: string, email: string, passphrase: string) =>
      ipcRenderer.invoke('key:generate', name, email, passphrase),
    importKey: (armored: string) => ipcRenderer.invoke('key:import', armored),
    unlock: (passphrase: string) => ipcRenderer.invoke('key:unlock', passphrase),
    isSetup: () => ipcRenderer.invoke('key:isSetup'),
    getKeyInfo: () => ipcRenderer.invoke('key:getKeyInfo'),
    reset: () => ipcRenderer.invoke('key:reset'),
    exportToGnuPG: () => ipcRenderer.invoke('key:exportToGnuPG')
  },
  git: {
    init: (dir: string) => ipcRenderer.invoke('git:init', dir),
    clone: (url: string) => ipcRenderer.invoke('git:clone', url),
    status: () => ipcRenderer.invoke('git:status'),
    pull: () => ipcRenderer.invoke('git:pull'),
    push: () => ipcRenderer.invoke('git:push'),
    commit: (message: string) => ipcRenderer.invoke('git:commit', message),
    getRemote: () => ipcRenderer.invoke('git:getRemote'),
    setRemote: (url: string) => ipcRenderer.invoke('git:setRemote', url),
    hasRepo: () => ipcRenderer.invoke('git:hasRepo'),
    branch: () => ipcRenderer.invoke('git:branch')
  }
}

contextBridge.exposeInMainWorld('api', api)
